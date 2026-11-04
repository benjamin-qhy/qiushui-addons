import type { ExtensionStorage } from "./compat/extension-kv.js";
import { loadConfig } from "./config.js";

export type TicketCategory = "account" | "order" | "billing" | "product" | "other";
export type TicketPriority = "normal" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved";

export interface Ticket {
  id: string;
  customer: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
  createdAt: string;
  updatedAt: string;
  slaDeadline: string;
}

export interface Activity {
  id: string;
  ticketId: string;
  message: string;
  at: string;
}

export interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  waiting: number;
  resolved: number;
  urgent: number;
  overdue: number;
}

export interface Dashboard {
  config: ReturnType<typeof loadConfig>;
  tickets: Ticket[];
  activities: Activity[];
  stats: TicketStats;
  generatedAt: string;
}

type Clock = () => Date;

export class CustomerSupportService {
  constructor(private storage: ExtensionStorage, private now: Clock = () => new Date()) {}

  private tickets(): Ticket[] { return this.storage.get<Ticket[]>("tickets", "global") || []; }
  private saveTickets(tickets: Ticket[]): void { this.storage.set("tickets", tickets, "global"); }
  private activities(): Activity[] { return this.storage.get<Activity[]>("activities", "global") || []; }
  private record(ticketId: string, message: string): void {
    const at = this.now().toISOString();
    const next = [{ id: `A-${at}-${ticketId}`, ticketId, message, at }, ...this.activities()].slice(0, 30);
    this.storage.set("activities", next, "global");
  }
  private nextId(): string {
    const value = (this.storage.get<number>("ticket-sequence", "global") || 0) + 1;
    this.storage.set("ticket-sequence", value, "global");
    return `CS-${String(value).padStart(4, "0")}`;
  }
  private deadline(priority: TicketPriority, from: Date): string {
    const config = loadConfig(this.storage);
    const hours = priority === "urgent" ? config.urgentSlaHours : priority === "high" ? config.highSlaHours : config.normalSlaHours;
    return new Date(from.getTime() + hours * 3_600_000).toISOString();
  }

  list(filters: { status?: TicketStatus; priority?: TicketPriority } = {}): Ticket[] {
    return this.tickets().filter((ticket) => (!filters.status || ticket.status === filters.status) && (!filters.priority || ticket.priority === filters.priority));
  }

  get(id: string): Ticket | null { return this.tickets().find((ticket) => ticket.id === id) || null; }

  create(input: { customer: string; title: string; description?: string; category?: TicketCategory; priority?: TicketPriority; assignee?: string }): Ticket {
    const now = this.now();
    const config = loadConfig(this.storage);
    if (!input.customer?.trim() || !input.title?.trim()) throw new Error("客户名称和问题标题不能为空");
    const ticket: Ticket = {
      id: this.nextId(),
      customer: input.customer.trim().slice(0, 100),
      title: input.title.trim().slice(0, 160),
      description: String(input.description || "").trim().slice(0, 2000),
      category: input.category || "other",
      priority: input.priority || "normal",
      status: "open",
      assignee: input.assignee?.trim().slice(0, 80) || config.defaultAssignee,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      slaDeadline: this.deadline(input.priority || "normal", now),
    };
    this.saveTickets([ticket, ...this.tickets()]);
    this.record(ticket.id, `创建工单：${ticket.title}`);
    return ticket;
  }

  update(id: string, patch: { status?: TicketStatus; priority?: TicketPriority; assignee?: string; title?: string }): Ticket {
    const tickets = this.tickets();
    const index = tickets.findIndex((ticket) => ticket.id === id);
    if (index < 0) throw new Error(`找不到工单 ${id}`);
    const current = tickets[index]!;
    const priority = patch.priority || current.priority;
    const updated: Ticket = {
      ...current,
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.title?.trim() ? { title: patch.title.trim().slice(0, 160) } : {}),
      ...(patch.assignee?.trim() ? { assignee: patch.assignee.trim().slice(0, 80) } : {}),
      priority,
      updatedAt: this.now().toISOString(),
      ...(priority !== current.priority ? { slaDeadline: this.deadline(priority, new Date(current.createdAt)) } : {}),
    };
    tickets[index] = updated;
    this.saveTickets(tickets);
    this.record(id, `更新工单：状态 ${updated.status}，优先级 ${updated.priority}`);
    return updated;
  }

  close(id: string): Ticket { return this.update(id, { status: "resolved" }); }

  stats(): TicketStats {
    const tickets = this.tickets();
    const now = this.now().getTime();
    return {
      total: tickets.length,
      open: tickets.filter((item) => item.status === "open").length,
      inProgress: tickets.filter((item) => item.status === "in_progress").length,
      waiting: tickets.filter((item) => item.status === "waiting").length,
      resolved: tickets.filter((item) => item.status === "resolved").length,
      urgent: tickets.filter((item) => item.priority === "urgent" && item.status !== "resolved").length,
      overdue: tickets.filter((item) => item.status !== "resolved" && Date.parse(item.slaDeadline) < now).length,
    };
  }

  dashboard(): Dashboard {
    return { config: loadConfig(this.storage), tickets: this.tickets(), activities: this.activities(), stats: this.stats(), generatedAt: this.now().toISOString() };
  }

  seed(confirm: boolean): Dashboard {
    if (!confirm) throw new Error("载入演示数据前需要 confirm=true");
    if (this.tickets().length) throw new Error("已有工单，不会覆盖。请先导出，确认清空后再载入演示数据。");
    const examples = [
      { customer: "海风书店", title: "登录后总是返回登录页", description: "店长更换电脑后无法进入后台。", category: "account" as const, priority: "urgent" as const, status: "in_progress" as const, assignee: "小秋" },
      { customer: "星河咖啡", title: "上月发票金额需要核对", description: "财务发现发票与订单汇总差 20 元。", category: "billing" as const, priority: "high" as const, status: "waiting" as const, assignee: "小水" },
      { customer: "山谷营地", title: "希望支持批量导出订单", description: "旺季每天需要导出约 200 条订单。", category: "product" as const, priority: "normal" as const, status: "open" as const, assignee: "小秋" },
      { customer: "晴天花房", title: "配送地址已经修改", description: "客服已协助完成。", category: "order" as const, priority: "normal" as const, status: "resolved" as const, assignee: "小水" },
    ];
    for (const example of examples) {
      const ticket = this.create(example);
      if (example.status !== "open") this.update(ticket.id, { status: example.status });
    }
    return this.dashboard();
  }

  reset(confirm: boolean): Dashboard {
    if (!confirm) throw new Error("清空演示数据前需要 confirm=true");
    this.storage.delete("tickets", "global");
    this.storage.delete("activities", "global");
    this.storage.delete("ticket-sequence", "global");
    return this.dashboard();
  }

  incrementSessionUsage(sessionId: string): number {
    const key = "tool-calls";
    const count = (this.storage.get<number>(key, "chat", sessionId || "unknown") || 0) + 1;
    this.storage.set(key, count, "chat", sessionId || "unknown");
    return count;
  }

  report(): string {
    const dashboard = this.dashboard();
    const lines = [
      `# ${dashboard.config.teamName}工单简报`, "",
      `生成时间：${dashboard.generatedAt}`, "",
      `- 工单总数：${dashboard.stats.total}`,
      `- 待处理：${dashboard.stats.open + dashboard.stats.inProgress + dashboard.stats.waiting}`,
      `- 紧急工单：${dashboard.stats.urgent}`,
      `- 已超时：${dashboard.stats.overdue}`, "",
      "## 工单列表", "",
      "| 编号 | 客户 | 问题 | 优先级 | 状态 | 负责人 |", "| --- | --- | --- | --- | --- | --- |",
      ...dashboard.tickets.map((item) => `| ${item.id} | ${item.customer} | ${item.title.replaceAll("|", "\\|")} | ${item.priority} | ${item.status} | ${item.assignee} |`),
    ];
    return `${lines.join("\n")}\n`;
  }
}
