import { createExtensionStorage } from "../compat/extension-kv.js";
import { CustomerSupportService } from "../ticket-store.js";

interface RuntimeApi {
  registerStatusPanelProvider(provider: {
    key: string;
    getPayload(chatJid: string): unknown;
    runAction?(action: string, payload: Record<string, unknown>): unknown;
  }): () => void;
}

export function registerCustomerSupportRuntime(api: RuntimeApi, appService = new CustomerSupportService(createExtensionStorage("customer-support-demo"))): () => void {
  return api.registerStatusPanelProvider({
    key: "customer-support-demo",
    getPayload(chatJid) {
      const dashboard = appService.dashboard();
      return {
        key: "customer-support-demo",
        chat_jid: chatJid,
        title: "客户工单助手",
        generated_at: dashboard.generatedAt,
        content: [
          { type: "status", label: "待处理", value: dashboard.stats.open + dashboard.stats.inProgress + dashboard.stats.waiting },
          { type: "status", label: "紧急", value: dashboard.stats.urgent },
          { type: "status", label: "已超时", value: dashboard.stats.overdue },
        ],
      };
    },
    runAction(action) {
      if (action !== "refresh") throw new Error("该示例 Runtime 只支持 refresh");
      return { ok: true, ...appService.dashboard() };
    },
  });
}

const runtime = (globalThis as { __qiushuiai_runtime?: RuntimeApi }).__qiushuiai_runtime;
if (runtime?.registerStatusPanelProvider) registerCustomerSupportRuntime(runtime);
