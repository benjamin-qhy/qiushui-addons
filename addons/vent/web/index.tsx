/** @jsx React.createElement */
// @ts-nocheck -- React and shadcn components are supplied by QiushuiAI.
import { settingsFieldStyles } from "./settings-fields.ts";

const ADDON_ID = "vent";
const API = `/agent/addons/api/${ADDON_ID}`;
const DEFAULT_OUTPUT_PATH = "VENT.md";
const host = globalThis.__qiushuiaiWeb;
if (!host?.React || !host?.components || !host?.registerSettingsPane) throw new Error("QiushuiAI React add-on web host is unavailable");
const React = host.React;
const { Button, Input, Separator } = host.components;

async function loadConfig() {
  try { const response = await fetch(`${API}/config`); return response.ok ? await response.json() : { output_path: DEFAULT_OUTPUT_PATH }; } catch { return { output_path: DEFAULT_OUTPUT_PATH }; }
}
async function saveConfig(patch) {
  try { const response = await fetch(`${API}/config`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); return response.ok ? await response.json() : { ok: false, error: "Save failed" }; } catch { return { ok: false, error: "Save failed" }; }
}

function VentSettings() {
  const [cfg, setCfg] = React.useState(null);
  const [draft, setDraft] = React.useState(DEFAULT_OUTPUT_PATH);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  React.useEffect(() => { void loadConfig().then((next) => { setCfg(next); setDraft(next.output_path || DEFAULT_OUTPUT_PATH); }); }, []);
  const save = async () => { setSaving(true); setMessage(""); const result = await saveConfig({ output_path: draft }); if (result.ok && result.config) { setCfg(result.config); setDraft(result.config.output_path); setMessage("Saved."); } else setMessage(result.error || "Save failed."); setSaving(false); };
  if (!cfg) return <p role="status">Loading…</p>;
  return <div data-settings-addon="vent"><style>{settingsFieldStyles}</style><h4>Output</h4><div className="settings-addon-field"><label className="settings-addon-label" htmlFor="vent-output">Output file</label><Input id="vent-output" value={draft} placeholder={DEFAULT_OUTPUT_PATH} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(); }} disabled={saving} /><span className="settings-addon-help">Relative to the current workspace. Nested paths are allowed and missing directories are created automatically.</span><Button onClick={save} disabled={saving || draft === cfg.output_path}>Save</Button></div><Separator /><h4>Attribution</h4><p className="settings-addon-help">Adapted from <a href="https://github.com/IgorWarzocha/pi-vent" target="_blank" rel="noreferrer">pi-vent</a> by Igor Warzocha (MIT).</p>{message ? <p role={/failed/i.test(message) ? "alert" : "status"}>{message}</p> : null}</div>;
}

host.registerSettingsPane({ id: ADDON_ID, label: "情绪记录", component: VentSettings, order: 181 });
