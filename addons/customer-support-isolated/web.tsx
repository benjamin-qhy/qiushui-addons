/** The host supplies React, local shadcn components, translations and an instance-bound request. */
export function createPage(host: any) {
  const { React, components: { Button, Badge }, request, useTranslation } = host;
  return function CustomerSupportPage() {
    const { i18n } = useTranslation();
    const zh = i18n.language.startsWith("zh");
    const [dashboard, setDashboard] = React.useState(null);
    const [error, setError] = React.useState(false);
    const refresh = () => request("/").then((value: any) => { setDashboard(value); setError(false); }).catch(() => setError(true));
    React.useEffect(() => { let active = true; request("/").then((value: any) => { if (active) setDashboard(value); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, []);
    return <section className="space-y-4" aria-label={zh ? "客户工单" : "Support tickets"}>
      <div className="flex items-center justify-between"><h3>{zh ? "客户工单" : "Support tickets"}</h3><Button variant="outline" onClick={refresh}>{zh ? "刷新" : "Refresh"}</Button></div>
      {error ? <p role="alert">{zh ? "读取失败，请重试。" : "Unable to load. Please retry."}</p> : null}
      {dashboard ? <><p className="text-sm text-muted-foreground">{zh ? "工单数量" : "Tickets"}: {dashboard.stats.total}</p><ul className="space-y-2">{dashboard.tickets.map((ticket: any) => <li key={ticket.id} className="flex items-center gap-2 border-b py-2"><span>{ticket.id} · {ticket.title} · {ticket.customer}</span><Badge>{ticket.status === "resolved" ? (zh ? "已关闭" : "Resolved") : (zh ? "待处理" : "Open")}</Badge>{ticket.status !== "resolved" ? <Button size="sm" variant="outline" onClick={() => request("/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ticket.id }) }).then((value: any) => { setDashboard(value); setError(false); }).catch(() => setError(true))}>{zh ? "关闭工单" : "Close ticket"}</Button> : null}</li>)}</ul></> : <p role="status">{zh ? "正在加载…" : "Loading…"}</p>}
    </section>;
  };
}
