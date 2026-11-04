import type * as ReactApi from "react";

type ElementComponent = ReactApi.ComponentType<ReactApi.HTMLAttributes<HTMLElement>>;
interface Pane {
  id: string;
  label: string;
  labels?: Record<string, string>;
  component: ReactApi.ComponentType;
  order?: number;
}
/** Types only: React and all controls are provided by QiushuiAI, never bundled twice. */
export interface AddonWebHost {
  React: typeof ReactApi;
  request<T>(path: string, init?: RequestInit): Promise<T>;
  i18n: { addResourceBundle(locale: string, namespace: string, values: Record<string, string>, deep: boolean, overwrite: boolean): void };
  useTranslation(namespace: string): { t(key: string): string };
  registerSettingsPane(pane: Pane): () => void;
  registerWorkspacePane(pane: Pane): () => void;
  components: {
    Badge: ReactApi.ComponentType<ReactApi.HTMLAttributes<HTMLSpanElement> & { variant?: "secondary" | "outline" | "destructive" }>;
    Button: ReactApi.ComponentType<ReactApi.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "outline" | "ghost" | "destructive"; size?: "sm" }>;
    Input: ReactApi.ComponentType<ReactApi.InputHTMLAttributes<HTMLInputElement>>;
    Switch: ReactApi.ComponentType<{ id?: string; checked: boolean; onCheckedChange(value: boolean): void }>;
    Field: ElementComponent;
    FieldGroup: ElementComponent;
    FieldLabel: ReactApi.ComponentType<ReactApi.LabelHTMLAttributes<HTMLLabelElement>>;
    FieldDescription: ElementComponent;
  };
}
const candidate = (globalThis as unknown as { __qiushuiaiWeb?: AddonWebHost }).__qiushuiaiWeb;
if (!candidate?.registerWorkspacePane) throw new Error("QiushuiAI React workspace host is required");
export const host = candidate;
