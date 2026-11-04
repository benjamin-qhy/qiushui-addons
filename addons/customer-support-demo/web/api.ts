import type { Dashboard } from "../ticket-store.js";
import type { SupportConfig } from "../config.js";
import { host } from "./host.ts";
const request = host.request;
const base = "/agent/addons/api/customer-support-demo";
const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
export const api = {
  dashboard: () => request<Dashboard>(base + "/dashboard"),
  saveConfig: (config: SupportConfig) => request(base + "/config", post(config)),
  command: (command: Record<string, unknown>) => request(base + "/command", post(command)),
  runtime: () => request<{ payload: unknown }>(base + "/runtime-status"),
  report: () => request<{ filename: string; content: string }>(base + "/report"),
  hasSecret: async (name: string) => (await request<{ entries: { name: string }[] }>("/agent/keychain")).entries.some(entry => entry.name === name),
  saveSecret: (name: string, secret: string) => request("/agent/keychain", post({ name, secret, type: "token" })),
};
