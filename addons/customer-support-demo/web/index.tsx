/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import type { Dashboard } from "../ticket-store.js";
import type { SupportConfig } from "../config.js";
import { host } from "./host.ts";
import { styles } from "./styles.ts";
import { api } from "./api.ts";
import { resources } from "./translations.ts";

const React = host.React;
const { Badge, Button, Input, Switch, Field, FieldGroup, FieldLabel, FieldDescription } = host.components;
for (const [locale, strings] of Object.entries(resources)) host.i18n.addResourceBundle(locale, "customer-support-demo", strings, true, true);
const useText = () => host.useTranslation("customer-support-demo").t;
const secretName = "customer-support-demo/crm-token";

function useDemo() {
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const refresh = React.useCallback(async () => { const result = await api.dashboard(); setData(result); return result; }, []);
  const act = async (fn: () => Promise<unknown>, success = "") => {
    setBusy(true); setError(""); setMessage("");
    try { await fn(); await refresh(); setMessage(success); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  React.useEffect(() => { void refresh().catch(cause => setError(String(cause.message))); }, [refresh]);
  return { data, error, busy, message, refresh, act };
}
function Feedback({ model }: { model: ReturnType<typeof useDemo> }) {
  return <>{model.error ? <p role="alert" className="cs-demo__error">{model.error}</p> : null}{model.message ? <p role="status">{model.message}</p> : null}</>;
}
function CustomerSupportSettings() {
  const t = useText();
  const model = useDemo();
  const [draft, setDraft] = React.useState<SupportConfig | null>(null);
  const [secret, setSecret] = React.useState("");
  const [hasSecret, setHasSecret] = React.useState(false);
  React.useEffect(() => { if (model.data && !draft) setDraft(model.data.config); }, [model.data, draft]);
  React.useEffect(() => { void api.hasSecret(secretName).then(setHasSecret).catch(() => {}); }, []);
  return <section className="cs-demo" aria-label={t("settings")}><style>{styles}</style>
    <header><h2>{t("settings")}</h2><p className="cs-demo__muted">{t("settingsHint")}</p></header>
    <Feedback model={model} />
    {!draft ? <p role="status">{t("loading")}</p> : <form className="cs-demo__form" onSubmit={event => { event.preventDefault(); void model.act(() => api.saveConfig(draft), t("saved")); }}>
      <FieldGroup>
        <Field><FieldLabel htmlFor="cs-enabled">{t("enabled")}</FieldLabel><Switch id="cs-enabled" checked={draft.enabled} onCheckedChange={enabled => setDraft({ ...draft, enabled })} /><FieldDescription>{t("enabledHint")}</FieldDescription></Field>
        {(["teamName", "defaultAssignee", "normalSlaHours", "highSlaHours", "urgentSlaHours"] as const).map(key => <Field key={key}><FieldLabel htmlFor={"cs-" + key}>{t(key)}</FieldLabel><Input id={"cs-" + key} type={key.endsWith("Hours") ? "number" : "text"} min={key.endsWith("Hours") ? 1 : undefined} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: key.endsWith("Hours") ? Number(event.target.value) : event.target.value })} /></Field>)}
      </FieldGroup>
      <Button type="submit" disabled={model.busy}>{t("save")}</Button>
      <Field><FieldLabel htmlFor="cs-secret">{t("secret")}</FieldLabel><Input id="cs-secret" type="password" autoComplete="new-password" value={secret} onChange={event => setSecret(event.target.value)} /><FieldDescription>{hasSecret ? t("secretSaved") : t("secretHint")}</FieldDescription><Button type="button" variant="outline" disabled={model.busy || !secret.trim()} onClick={() => model.act(async () => { await api.saveSecret(secretName, secret); setSecret(""); setHasSecret(true); }, t("secretSaved"))}>{t("saveSecret")}</Button></Field>
    </form>}
  </section>;
}
function CustomerSupportWorkbench() {
  const t = useText();
  const model = useDemo();
  const [runtime, setRuntime] = React.useState<unknown>(null);
  React.useEffect(() => {
    let active = true;
    const timer = setInterval(() => { void model.refresh().catch(() => {}); }, 3000);
    void api.runtime().then(value => { if (active) setRuntime(value.payload); }).catch(() => {});
    return () => { active = false; clearInterval(timer); };
  }, [model.refresh]);
  const download = async () => {
    const report = await api.report();
    const url = URL.createObjectURL(new Blob([report.content], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = report.filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="cs-demo" aria-label={t("workbench")}><style>{styles}</style>
    <header><h2>{t("workbench")}</h2><p className="cs-demo__muted">{t("hint")}</p></header>
    <div className="cs-demo__actions"><Badge variant={runtime ? "secondary" : "outline"}>{runtime ? t("runtimeReady") : t("runtimePending")}</Badge><Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("qiushuiai:open-addon-settings", { detail: "customer-support-demo" }))}>{t("settings")}</Button></div>
    <p>{t("prompt")}</p>
    <div className="cs-demo__actions">
      <Button disabled={model.busy} onClick={() => model.act(() => navigator.clipboard.writeText(t("prompt")), t("copied"))}>{t("copy")}</Button>
      <Button variant="outline" disabled={model.busy} onClick={() => model.act(download, t("exported"))}>{t("export")}</Button>
      <Button variant="outline" disabled={model.busy} onClick={() => model.act(model.refresh)}>{t("refresh")}</Button>
      <Button variant="outline" disabled={model.busy || !!model.data?.tickets.length} onClick={() => model.act(() => api.command({ action: "seed_demo", confirm: true }), t("seeded"))}>{t("seed")}</Button>
    </div>
    <Feedback model={model} />
    {!model.data ? <p role="status">{t("loading")}</p> : <>
      <div className="cs-demo__stats">{(["total", "inProgress", "waiting", "resolved"] as const).map(key => <div key={key}><span className="cs-demo__muted">{t(key)}</span><strong>{model.data!.stats[key]}</strong></div>)}</div>
      <div>{model.data.tickets.length ? model.data.tickets.map(ticket => <article className="cs-demo__ticket" key={ticket.id}>
        <div className="cs-demo__actions"><strong>{ticket.id}</strong><Badge variant={ticket.priority === "urgent" ? "destructive" : "secondary"}>{t(ticket.priority)}</Badge><Badge variant="outline">{t(ticket.status)}</Badge></div>
        <h3>{ticket.title}</h3><p>{ticket.customer} · {ticket.assignee}</p><p className="cs-demo__muted">{ticket.description}</p>
        {ticket.status !== "resolved" ? <div className="cs-demo__actions">{["in_progress", "waiting", "resolved"].filter(status => status !== ticket.status).map(status => <Button key={status} variant="outline" size="sm" disabled={model.busy} onClick={() => model.act(() => api.command({ action: "update", id: ticket.id, status }), t("updated"))}>{t(status)}</Button>)}</div> : null}
      </article>) : <p>{t("empty")}</p>}</div>
      <section><h3>{t("activity")}</h3>{model.data.activities.slice(0, 5).map(item => <p className="cs-demo__muted" key={item.id}>{item.ticketId} · {item.message}</p>)}</section>
      <p className="cs-demo__muted">{t("boundary")}</p>
    </>}
  </section>;
}
host.registerSettingsPane({ id: "customer-support-demo", label: "客户工单助手", labels: { "zh-CN": "客户工单助手", "en-US": "Customer support" }, component: CustomerSupportSettings, order: 190 });
host.registerWorkspacePane({ id: "customer-support-demo", label: "客户工单工作台", labels: { "zh-CN": "客户工单工作台", "en-US": "Support workbench" }, component: CustomerSupportWorkbench, order: 190 });
