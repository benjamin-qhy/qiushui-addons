import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";

import { createExtensionStorage, type ExtensionStorage } from "./compat/extension-kv.js";
import { loadConfig, updateConfig, type SupportConfig } from "./config.js";
import { CustomerSupportService, type TicketPriority, type TicketStatus } from "./ticket-store.js";

const ADDON_ID = "customer-support-demo";
const baseDir = import.meta.dir;
const storage = createExtensionStorage(ADDON_ID);
const service = new CustomerSupportService(storage);
async function runtimeStatus() {
  const runtime = (globalThis as { __qiushuiai_runtime?: { getStatusPanelPayload(key: string, chatJid: string): Promise<unknown> } }).__qiushuiai_runtime;
  if (!runtime?.getStatusPanelPayload) throw new Error("Runtime status API unavailable");
  const payload = await runtime.getStatusPanelPayload(ADDON_ID, "");
  if (!payload) throw new Error("Runtime provider is not registered");
  return payload;
}

const ToolParameters = Type.Object({
  action: Type.Union([
    Type.Literal("create"), Type.Literal("list"), Type.Literal("get"), Type.Literal("update"),
    Type.Literal("close"), Type.Literal("summary"), Type.Literal("seed_demo"), Type.Literal("reset_demo"),
    Type.Literal("report"), Type.Literal("runtime_status"),
  ]),
  id: Type.Optional(Type.String({ description: "工单编号，例如 CS-0001" })),
  customer: Type.Optional(Type.String({ description: "客户名称" })),
  title: Type.Optional(Type.String({ description: "问题标题" })),
  description: Type.Optional(Type.String({ description: "问题详情" })),
  category: Type.Optional(Type.Union([Type.Literal("account"), Type.Literal("order"), Type.Literal("billing"), Type.Literal("product"), Type.Literal("other")])),
  priority: Type.Optional(Type.Union([Type.Literal("normal"), Type.Literal("high"), Type.Literal("urgent")])),
  status: Type.Optional(Type.Union([Type.Literal("open"), Type.Literal("in_progress"), Type.Literal("waiting"), Type.Literal("resolved")])),
  assignee: Type.Optional(Type.String({ description: "负责人" })),
  confirm: Type.Optional(Type.Boolean({ description: "载入或清空演示数据时必须为 true" })),
});
type ToolInput = Static<typeof ToolParameters>;

type AddonConfigApiRegistrar = (
  addonId: string,
  action: string,
  handlers: { get?: (payload: unknown, req: Request) => unknown | Promise<unknown>; set?: (payload: unknown, req: Request) => unknown | Promise<unknown> },
  extensionPath?: string,
) => "created" | "updated";

function objectPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
}

export function registerCustomerSupportConfigApi(registrar: AddonConfigApiRegistrar, appService = service, appStorage = storage): void {
  registrar(ADDON_ID, "config", {
    get: () => ({ ok: true, config: loadConfig(appStorage) }),
    set: (payload) => ({ ok: true, config: updateConfig(appStorage, objectPayload(payload) as Partial<SupportConfig>) }),
  }, baseDir);
  registrar(ADDON_ID, "dashboard", { get: () => ({ ok: true, ...appService.dashboard() }) }, baseDir);
  registrar(ADDON_ID, "runtime-status", { get: async () => ({ ok: true, payload: await runtimeStatus() }) }, baseDir);
  registrar(ADDON_ID, "command", {
    set: (payload) => {
      const input = objectPayload(payload);
      if (input.action === "seed_demo") return { ok: true, ...appService.seed(input.confirm === true) };
      if (input.action === "reset_demo") return { ok: true, ...appService.reset(input.confirm === true) };
      if (input.action === "update") return { ok: true, ticket: appService.update(String(input.id || ""), input as { status?: TicketStatus; priority?: TicketPriority; assignee?: string; title?: string }) };
      throw new Error("不支持的面板操作");
    },
  }, baseDir);
  registrar(ADDON_ID, "report", { get: () => ({ ok: true, filename: "customer-support-report.md", content: appService.report() }) }, baseDir);
}

const registrar = (globalThis as Record<string, unknown>).__qiushuiai_registerAddonConfigApi as AddonConfigApiRegistrar | undefined;
if (typeof registrar === "function") registerCustomerSupportConfigApi(registrar);

export function runSupportAction(input: ToolInput, appService = service): unknown {
  switch (input.action) {
    case "create": return appService.create({ customer: input.customer || "", title: input.title || "", description: input.description, category: input.category, priority: input.priority, assignee: input.assignee });
    case "list": return appService.list({ status: input.status, priority: input.priority });
    case "get": return appService.get(input.id || "");
    case "update": return appService.update(input.id || "", { status: input.status, priority: input.priority, assignee: input.assignee, title: input.title });
    case "close": return appService.close(input.id || "");
    case "summary": return appService.dashboard();
    case "report": return { filename: "customer-support-report.md", content: appService.report() };
    case "runtime_status": return runtimeStatus();
    case "seed_demo": return appService.seed(input.confirm === true);
    case "reset_demo": return appService.reset(input.confirm === true);
  }
}

export default function customerSupportDemo(pi: ExtensionAPI): void {
  pi.on("resources_discover", () => ({ skillPaths: [join(baseDir, "skills", "customer-support-workflow", "SKILL.md")] }));
  pi.registerTool({
    name: "support_ticket",
    label: "support_ticket",
    description: "管理本地虚拟客户工单：创建、查询、流转、关闭、汇总，或载入演示数据。不会连接真实 CRM，也不会发送真实消息。",
    promptSnippet: "使用 support_ticket 管理本地客户工单。",
    parameters: ToolParameters,
    executionMode: "sequential",
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!loadConfig(storage).enabled) throw new Error("客户工单助手已在设置中停用，请先启用后再操作。Customer support assistant is disabled.");
      const result = await runSupportAction(params);
      const bridge = (globalThis as { __qiushuiaiRuntimeInterop?: { getChatJid?(fallback: string): string } }).__qiushuiaiRuntimeInterop;
      const sessionCalls = service.incrementSessionUsage(bridge?.getChatJid?.("") || ctx.sessionManager.getSessionId());
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ sessionCalls, result }, null, 2) }],
        details: { action: params.action, sessionCalls, result },
      };
    },
  });
  pi.on("before_agent_start", async (event) => {
    const config = loadConfig(storage);
    if (!config.enabled) return {};
    return {
      systemPrompt: `${event.systemPrompt}\n\n## 客户工单助手（示例）\n你可以使用 support_ticket 管理本地虚拟工单。真实外部系统和真实消息发送均未启用；不要声称已经联系客户。`,
    };
  });
}
