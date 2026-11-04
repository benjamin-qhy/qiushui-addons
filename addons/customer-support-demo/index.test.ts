import { expect, test } from "bun:test";
import { createExtensionStorage } from "./compat/extension-kv.js";
import customerSupportDemo, { registerCustomerSupportConfigApi, runSupportAction } from "./index.js";
import { CustomerSupportService } from "./ticket-store.js";

test("exports an extension and exposes one deep business tool", () => {
  const registrations: Array<{ name: string }> = [];
  customerSupportDemo({
    on() {},
    registerTool(tool: { name: string }) { registrations.push(tool); },
  } as never);
  expect(registrations.map((item) => item.name)).toEqual(["support_ticket"]);
});

test("disabled tool refuses writes, and re-enabled tool reports per-session usage", async () => {
  const actions = new Map<string, any>();
  let tool: any;
  registerCustomerSupportConfigApi((_id, action, handlers) => { actions.set(action, handlers); return "created"; });
  customerSupportDemo({ on() {}, registerTool(value: unknown) { tool = value; } } as never);
  const req = new Request("http://localhost");
  actions.get("config").set({ enabled: false }, req);
  const ctx = { sessionManager: { getSessionId: () => "disabled-test" } };
  await expect(tool.execute("call", { action: "create", customer: "Fake", title: "Must not save" }, undefined, undefined, ctx)).rejects.toThrow("disabled");
  expect(actions.get("dashboard").get().stats.total).toBe(0);
  actions.get("config").set({ enabled: true }, req);
  const result = await tool.execute("call", { action: "summary" }, undefined, undefined, ctx);
  expect(result.details.sessionCalls).toBe(1);
});

test("tool actions share the same ticket service", () => {
  const storage = createExtensionStorage(`support-actions-${crypto.randomUUID()}`);
  const service = new CustomerSupportService(storage, () => new Date("2026-09-21T08:00:00.000Z"));
  const created = runSupportAction({ action: "create", customer: "海风书店", title: "无法登录", priority: "urgent" }, service) as { id: string };
  expect(created.id).toBe("CS-0001");
  expect(runSupportAction({ action: "list", priority: "urgent" }, service)).toHaveLength(1);
  expect((runSupportAction({ action: "close", id: created.id }, service) as { status: string }).status).toBe("resolved");
});

test("registers config, dashboard, command and report APIs", async () => {
  const storage = createExtensionStorage(`support-api-${crypto.randomUUID()}`);
  const service = new CustomerSupportService(storage, () => new Date("2026-09-21T08:00:00.000Z"));
  const actions = new Map<string, { get?: (payload: unknown, request: Request) => unknown; set?: (payload: unknown, request: Request) => unknown }>();
  registerCustomerSupportConfigApi((_addon, action, handlers) => { actions.set(action, handlers); return "created"; }, service, storage);
  expect([...actions.keys()]).toEqual(["config", "dashboard", "runtime-status", "command", "report"]);
  const seeded = await actions.get("command")!.set!({ action: "seed_demo", confirm: true }, new Request("http://localhost")) as { stats: { total: number } };
  expect(seeded.stats.total).toBe(4);
  const report = await actions.get("report")!.get!(undefined, new Request("http://localhost")) as { content: string };
  expect(report.content).toContain("工单简报");
});
