/** @jsx React.createElement */
// @ts-nocheck -- React and shadcn components are supplied by QiushuiAI.
import { settingsStyles } from "./styles.ts";

const ADDON_ID = "sample-addon";
const API = `/agent/addons/api/${ADDON_ID}`;
const DEFAULT_KEYCHAIN_ENTRY = "sample-addon/api-key";
const host = globalThis.__qiushuiaiWeb;
if (!host?.React || !host?.components || !host?.registerSettingsPane) throw new Error("QiushuiAI React add-on web host is unavailable");
const React = host.React;
const { Badge, Button, Input, Separator, Switch } = host.components;

async function loadKeychainHas(name) {
  try { const response = await fetch("/agent/keychain"); const data = response.ok ? await response.json() : {}; return (data.entries || []).some((entry) => entry.name === name); } catch { return false; }
}
async function setKeychainSecret(name, secret) {
  try { return (await fetch("/agent/keychain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, secret, type: "token" }) })).ok; } catch { return false; }
}
async function loadConfig() {
  try { const response = await fetch(`${API}/config`); const data = response.ok ? await response.json() : {}; return data?.config && typeof data.config === "object" ? data.config : data; } catch { return {}; }
}
async function saveConfig(patch) {
  try { const response = await fetch(`${API}/config`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); return response.ok ? await response.json() : { ok: false, error: "Save failed" }; } catch { return { ok: false, error: "Save failed" }; }
}

function SampleAddonSettings() {
  const [cfg, setCfg] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [hasKey, setHasKey] = React.useState(false);
  const [secret, setSecret] = React.useState("");
  const load = React.useCallback(async () => { const next = await loadConfig(); setCfg(next); setHasKey(await loadKeychainHas(next.secret_keychain || DEFAULT_KEYCHAIN_ENTRY)); }, []);
  React.useEffect(() => { void load(); }, [load]);
  const save = React.useCallback(async (patch) => { setSaving(true); setMessage(""); const result = await saveConfig(patch); if (result.ok && result.config) { setCfg(result.config); setMessage("Saved"); } else setMessage(result.error || "Save failed"); setSaving(false); }, []);
  const saveSecret = React.useCallback(async () => { if (!secret.trim()) return; setSaving(true); const ok = await setKeychainSecret(cfg?.secret_keychain || DEFAULT_KEYCHAIN_ENTRY, secret.trim()); setSaving(false); if (ok) { setHasKey(true); setSecret(""); setMessage("Secret saved to keychain. Restart required."); } else setMessage("Failed to save secret."); }, [cfg, secret]);
  if (!cfg) return <p role="status">Loading…</p>;
  return <div className="sample-addon-settings"><style>{settingsStyles}</style>
    <section className="settings-addon-section"><h4>General</h4><div className="settings-addon-control-group"><span className="settings-addon-label">Enabled</span><Switch checked={cfg.enabled} onCheckedChange={(enabled) => void save({ enabled })} disabled={saving} /></div><div className="settings-addon-field"><label className="settings-addon-label" htmlFor="sample-addon-greeting">Greeting</label><Input id="sample-addon-greeting" aria-describedby="sample-addon-greeting-help" value={cfg.greeting || ""} onChange={(event) => setCfg({ ...cfg, greeting: event.target.value })} onBlur={(event) => void save({ greeting: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} disabled={saving} /><span id="sample-addon-greeting-help" className="settings-addon-help">A non-secret value stored in the runtime database.</span></div></section>
    <Separator />
    <section className="settings-addon-section"><h4>Secret (keychain)</h4><div className="settings-addon-field"><label className="settings-addon-label" htmlFor="sample-addon-api-key">API key</label><div className="settings-addon-control-group"><Input id="sample-addon-api-key" type="password" aria-describedby="sample-addon-api-key-help" value={secret} placeholder={hasKey ? "••••••• (stored in keychain)" : "paste secret here"} onChange={(event) => setSecret(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveSecret(); }} disabled={saving} /><Button variant="outline" onClick={saveSecret} disabled={saving}>Save</Button><Badge variant={hasKey ? "secondary" : "destructive"} title={hasKey ? "Key in keychain" : "No key"}>{hasKey ? "✓" : "✗"}</Badge></div><span id="sample-addon-api-key-help" className="settings-addon-help">Saved to the system keychain. The page never reads the secret back.</span></div></section>
    {message ? <div className={/failed/i.test(message) ? "settings-addon-error" : "settings-addon-status"} role={/failed/i.test(message) ? "alert" : "status"}>{message}</div> : null}
  </div>;
}

host.registerSettingsPane({ id: ADDON_ID, label: "示例插件", component: SampleAddonSettings, order: 200 });
