/** @jsx React.createElement */
// @ts-nocheck -- React and shadcn components are supplied by QiushuiAI.
import { settingsFieldStyles } from "./settings-fields.ts";

const ADDON_ID = "observability";
const API = `/agent/addons/api/${ADDON_ID}`;
const KEYCHAIN_ENTRY = "azure/appinsights-connection-string";
const host = globalThis.__qiushuiaiWeb;
if (!host?.React || !host?.components || !host?.registerSettingsPane) throw new Error("QiushuiAI React add-on web host is unavailable");
const React = host.React;
const { Badge, Button, Input, Separator, Switch } = host.components;

async function keychainHas(name) { try { const response = await fetch("/agent/keychain"); const data = response.ok ? await response.json() : {}; return (data.entries || []).some((entry) => entry.name === name); } catch { return false; } }
async function saveSecret(name, secret) { try { return (await fetch("/agent/keychain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, secret, type: "secret" }) })).ok; } catch { return false; } }
async function getConfig() { const response = await fetch(`${API}/config`); if (!response.ok) throw new Error("Failed to load config"); return response.json(); }
async function setConfig(patch) { const response = await fetch(`${API}/config`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "Save failed"); return data.config; }

function ObservabilitySettings() {
  const [cfg, setCfg] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [hasKey, setHasKey] = React.useState(false);
  const [secret, setSecretInput] = React.useState("");
  React.useEffect(() => { void Promise.all([getConfig(), keychainHas(KEYCHAIN_ENTRY)]).then(([config, present]) => { setCfg(config); setHasKey(present); }).catch((error) => setMessage(error.message)); }, []);
  const save = React.useCallback(async (patch) => { setSaving(true); setMessage(""); try { setCfg(await setConfig(patch)); setMessage("Saved"); } catch (error) { setMessage(error.message); } finally { setSaving(false); } }, []);
  const saveConnectionString = async () => { if (!secret.trim()) return; setSaving(true); const ok = await saveSecret(KEYCHAIN_ENTRY, secret.trim()); if (ok) { setHasKey(true); setSecretInput(""); await save({ appinsights_keychain: KEYCHAIN_ENTRY }); setMessage("Connection string saved to keychain. Restart required."); } else { setMessage("Failed to save connection string."); setSaving(false); } };
  if (!cfg) return <p role="status">Loading…</p>;

  const Toggle = ({ label, name }) => <div className="settings-addon-control-group"><label className="settings-addon-label" htmlFor={`obs-${name}`}>{label}</label><Switch id={`obs-${name}`} checked={Boolean(cfg[name])} onCheckedChange={(value) => void save({ [name]: value })} disabled={saving} /></div>;
  const TextField = ({ label, name, placeholder = "" }) => <div className="settings-addon-field"><label className="settings-addon-label" htmlFor={`obs-${name}`}>{label}</label><Input id={`obs-${name}`} value={cfg[name] ?? ""} placeholder={placeholder} onChange={(event) => setCfg({ ...cfg, [name]: event.target.value })} onBlur={(event) => void save({ [name]: event.target.value })} disabled={saving} /></div>;
  const NumberField = ({ label, name, placeholder = "" }) => <div className="settings-addon-field"><label className="settings-addon-label" htmlFor={`obs-${name}`}>{label}</label><Input id={`obs-${name}`} type="number" value={cfg[name] ?? ""} placeholder={placeholder} onChange={(event) => setCfg({ ...cfg, [name]: Number(event.target.value) })} onBlur={(event) => void save({ [name]: Number(event.target.value) })} disabled={saving} /></div>;

  return <div data-settings-addon="observability"><style>{settingsFieldStyles}</style>
    <h4>General</h4><Toggle label="Enabled" name="enabled" /><TextField label="Instance name" name="instance_name" placeholder={location?.hostname || ""} /><p className="settings-addon-help">Identifies this QiushuiAI instance in telemetry. Blank uses the hostname.</p>
    <Separator /><h4>Azure Application Insights</h4><Toggle label="App Insights enabled" name="appinsights_enabled" /><div className="settings-addon-field"><label className="settings-addon-label" htmlFor="observability-secret">Connection string</label><div className="settings-addon-control-group"><Input id="observability-secret" type="password" value={secret} placeholder={hasKey ? "••••••• (stored in keychain)" : "InstrumentationKey=...;IngestionEndpoint=..."} onChange={(event) => setSecretInput(event.target.value)} disabled={saving} /><Button variant="outline" onClick={saveConnectionString} disabled={!secret.trim() || saving}>Save</Button><Badge variant={hasKey ? "secondary" : "destructive"}>{hasKey ? "✓ Key in keychain" : "No key"}</Badge></div></div><Toggle label="Live Metrics Stream" name="appinsights_live_metrics" /><Toggle label="Standard metrics" name="appinsights_standard_metrics" /><NumberField label="Sampling ratio" name="appinsights_sampling_ratio" placeholder="1" />
    <Separator /><h4>Graphite</h4><Toggle label="Graphite enabled" name="graphite_enabled" /><TextField label="Host" name="graphite_host" placeholder="192.168.1.250" /><NumberField label="Port" name="graphite_port" placeholder="2003" />
    <Separator /><h4>Usage and compaction telemetry</h4><Toggle label="Export usage and compaction telemetry" name="usage_telemetry_enabled" /><NumberField label="Export interval (minutes)" name="usage_telemetry_interval_minutes" placeholder="15" /><TextField label="Graphite render URL" name="graphite_render_url" placeholder="http://192.168.1.250:8086" />
    {message ? <p role={/failed/i.test(message) ? "alert" : "status"}>{message}</p> : null}
  </div>;
}

host.registerSettingsPane({ id: ADDON_ID, label: "可观测性", component: ObservabilitySettings, order: 170 });
