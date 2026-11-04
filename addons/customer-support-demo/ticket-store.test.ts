import { expect, test } from "bun:test";
import { createExtensionStorage } from "./compat/extension-kv.js";
import { updateConfig } from "./config.js";
import { CustomerSupportService } from "./ticket-store.js";

function fixture() {
  const storage = createExtensionStorage(`customer-support-test-${crypto.randomUUID()}`);
  const service = new CustomerSupportService(storage, () => new Date("2026-09-21T08:00:00.000Z"));
  return { storage, service };
}

test("creates, updates and reports a ticket through the service interface", () => {
  const { storage, service } = fixture();
  updateConfig(storage, { defaultAssignee: "测试客服", urgentSlaHours: 2 });
  const ticket = service.create({ customer: "演示客户", title: "无法登录", category: "account", priority: "urgent" });

  expect(ticket).toMatchObject({ id: "CS-0001", assignee: "测试客服", status: "open", priority: "urgent" });
  expect(ticket.slaDeadline).toBe("2026-09-21T10:00:00.000Z");
  expect(service.update(ticket.id, { status: "in_progress" }).status).toBe("in_progress");
  expect(service.close(ticket.id).status).toBe("resolved");
  expect(service.stats()).toMatchObject({ total: 1, resolved: 1, urgent: 0 });
  expect(service.report()).toContain("| CS-0001 | 演示客户 | 无法登录 |");
});

test("seed and reset require explicit confirmation and only touch addon data", () => {
  const { service } = fixture();
  expect(() => service.seed(false)).toThrow("confirm=true");
  expect(service.seed(true).stats.total).toBe(4);
  expect(() => service.seed(true)).toThrow("已有工单");
  expect(service.list()).toHaveLength(4);
  expect(() => service.reset(false)).toThrow("confirm=true");
  expect(service.reset(true).stats.total).toBe(0);
});

test("per-session counters stay separate", () => {
  const { service } = fixture();
  expect(service.incrementSessionUsage("chat-a")).toBe(1);
  expect(service.incrementSessionUsage("chat-a")).toBe(2);
  expect(service.incrementSessionUsage("chat-b")).toBe(1);
});
