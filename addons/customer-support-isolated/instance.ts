import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { CustomerSupportService } from "./ticket-store.js";
import type { ExtensionStorage } from "./compat/extension-kv.js";

/** Adapts the existing customer-support-demo domain service to an owner-bound instance. */
export function createInstance(context: { dataDir: string; instanceId: string; ownerId: string }) {
  const path = join(context.dataDir, "tickets.json");
  let values: Record<string, unknown> = {};
  try { values = JSON.parse(readFileSync(path, "utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const keyFor = (key: string, scope = "global", scopeKey = "") => JSON.stringify([scope, scopeKey, key]);
  const save = () => { const staged = `${path}.tmp`; writeFileSync(staged, JSON.stringify(values), { mode: 0o600 }); renameSync(staged, path); };
  const storage: ExtensionStorage = {
    get: <T>(key: string, scope?: string, scopeKey?: string) => structuredClone(values[keyFor(key, scope, scopeKey)] ?? null) as T | null,
    set(key, value, scope, scopeKey) { values[keyFor(key, scope, scopeKey)] = structuredClone(value); save(); },
    delete(key, scope, scopeKey) { const existed = Object.hasOwn(values, keyFor(key, scope, scopeKey)); delete values[keyFor(key, scope, scopeKey)]; save(); return existed; },
    list(prefix = "", scope = "global", scopeKey = "") { return Object.keys(values).map(key => JSON.parse(key) as string[]).filter(parts => parts[0] === scope && parts[1] === scopeKey && parts[2]!.startsWith(prefix)).map(parts => parts[2]!); },
    clear(scope = "global", scopeKey = "") { const keys = this.list("", scope, scopeKey); for (const key of keys) delete values[keyFor(key, scope, scopeKey)]; save(); return keys.length; },
  };
  const service = new CustomerSupportService(storage);
  const summary = () => ({ instanceId: context.instanceId, ownerId: context.ownerId, ...service.dashboard() });
  return {
    tools: [{ name: "support_ticket", description: "Manage local customer support tickets owned by the selected employee: create, list, close, summary. No external messages are sent.", parameters: { type: "object", properties: { action: { type: "string", enum: ["create", "list", "close", "summary"] }, customer: { type: "string" }, title: { type: "string" }, id: { type: "string" } }, required: ["action"], additionalProperties: false },
      execute(input: { action: string; customer?: string; title?: string; id?: string }) {
        const value = input.action === "create" ? service.create({ customer: input.customer ?? "", title: input.title ?? "" }) : input.action === "list" ? service.list() : input.action === "close" ? service.close(input.id ?? "") : summary();
        return { content: [{ type: "text", text: JSON.stringify({ instanceId: context.instanceId, value }) }], details: { instanceId: context.instanceId, value } };
      },
    }],
    async request(request: Request) {
      if (request.method === "GET") return Response.json(summary());
      if (request.method === "POST" && new URL(request.url).pathname === "/close") { const input = await request.json(); service.close(String(input.id)); return Response.json(summary()); }
      return new Response(null, { status: 405 });
    },
  };
}
