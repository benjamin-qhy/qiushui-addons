import type { ExtensionStorage } from "./compat/extension-kv.js";

export interface SupportConfig {
  enabled: boolean;
  teamName: string;
  defaultAssignee: string;
  normalSlaHours: number;
  highSlaHours: number;
  urgentSlaHours: number;
  crmSecretKeychain: string;
}

export const DEFAULT_CONFIG: SupportConfig = {
  enabled: true,
  teamName: "秋水客服组",
  defaultAssignee: "小秋",
  normalSlaHours: 24,
  highSlaHours: 8,
  urgentSlaHours: 2,
  crmSecretKeychain: "customer-support-demo/crm-token",
};

function positiveHours(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 720 ? parsed : fallback;
}

export function loadConfig(storage: ExtensionStorage): SupportConfig {
  return { ...DEFAULT_CONFIG, ...(storage.get<Partial<SupportConfig>>("config", "global") || {}) };
}

export function updateConfig(storage: ExtensionStorage, patch: Partial<SupportConfig>): SupportConfig {
  const current = loadConfig(storage);
  const next: SupportConfig = {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    teamName: typeof patch.teamName === "string" ? patch.teamName.trim().slice(0, 80) || current.teamName : current.teamName,
    defaultAssignee: typeof patch.defaultAssignee === "string" ? patch.defaultAssignee.trim().slice(0, 80) || current.defaultAssignee : current.defaultAssignee,
    normalSlaHours: positiveHours(patch.normalSlaHours, current.normalSlaHours),
    highSlaHours: positiveHours(patch.highSlaHours, current.highSlaHours),
    urgentSlaHours: positiveHours(patch.urgentSlaHours, current.urgentSlaHours),
    crmSecretKeychain: typeof patch.crmSecretKeychain === "string" ? patch.crmSecretKeychain.trim().slice(0, 160) || current.crmSecretKeychain : current.crmSecretKeychain,
  };
  storage.set("config", next, "global");
  return next;
}
