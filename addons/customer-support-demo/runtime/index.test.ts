import { expect, test } from "bun:test";
import { createExtensionStorage } from "../compat/extension-kv.js";
import { CustomerSupportService } from "../ticket-store.js";
import { registerCustomerSupportRuntime } from "./index.js";

test("runtime contributes an on-demand status provider without a timer", () => {
  let provider: any;
  const service = new CustomerSupportService(createExtensionStorage(`support-runtime-${crypto.randomUUID()}`), () => new Date("2026-09-21T08:00:00.000Z"));
  service.seed(true);
  registerCustomerSupportRuntime({ registerStatusPanelProvider(value) { provider = value; return () => {}; } }, service);
  const payload = provider.getPayload("web:test");
  expect(payload).toMatchObject({ key: "customer-support-demo", chat_jid: "web:test", title: "客户工单助手" });
  expect(payload.content).toHaveLength(3);
  expect(provider.runAction("refresh", {})).toMatchObject({ ok: true, stats: { total: 4 } });
});
