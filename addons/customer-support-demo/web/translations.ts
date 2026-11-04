export const resources = {
  "zh-CN": {
    settings: "客户工单助手设置", workbench: "客户工单工作台", settingsHint: "这里只配置助手。处理工单请在聊天中提出要求，或打开工作台。",
    enabled: "在聊天中启用工单助手", enabledHint: "关闭后工具会拒绝执行，不会修改已有工单。", teamName: "团队名称", defaultAssignee: "默认负责人",
    normalSlaHours: "普通工单时限（小时）", highSlaHours: "高优先级时限（小时）", urgentSlaHours: "紧急工单时限（小时）",
    save: "保存设置", saved: "设置已保存，新工单会采用新设置。", secret: "演示 CRM 密钥", secretHint: "仅输入假密钥，不会连接第三方系统。", secretSaved: "已保存到钥匙串，页面不会读取密钥原文。", saveSecret: "保存到系统钥匙串",
    hint: "和 AI 对话创建、流转工单，这里会自动更新。", runtimeReady: "Runtime 已验证", runtimePending: "Runtime 尚未验证",
    prompt: "请先阅读 customer-support-workflow 技能，把海风书店的登录故障记成紧急工单，说明分类、负责人和处理时限。", copy: "复制聊天示例", copied: "已复制，请粘贴到聊天中发送。", export: "导出本地简报", exported: "简报已导出。", refresh: "刷新", seed: "载入 4 条假工单", seeded: "演示工单已载入。", loading: "正在加载…", updated: "工单已更新。",
    total: "全部工单", inProgress: "正在处理", waiting: "等待客户", resolved: "已解决", normal: "普通", high: "高", urgent: "紧急", open: "待处理", in_progress: "处理中", empty: "还没有工单。在左侧聊天创建第一条工单，或载入假工单。", activity: "最近操作", boundary: "所有数据都在本地。没有真实 CRM、消息发送、审批或定时任务。"
  },
  "en-US": {
    settings: "Customer support settings", workbench: "Customer support workbench", settingsHint: "Configure the assistant here. Manage tickets in chat or in the workbench.",
    enabled: "Enable ticket tools in chat", enabledHint: "When off, tools refuse execution and leave tickets unchanged.", teamName: "Team name", defaultAssignee: "Default assignee", normalSlaHours: "Normal SLA (hours)", highSlaHours: "High SLA (hours)", urgentSlaHours: "Urgent SLA (hours)",
    save: "Save settings", saved: "Saved. New tickets use these defaults.", secret: "Demo CRM token", secretHint: "Use a fake token. No third-party connection is made.", secretSaved: "Saved in the keychain. The page never reads the secret back.", saveSecret: "Save to keychain",
    hint: "Create and update tickets in chat; this view refreshes automatically.", runtimeReady: "Runtime verified", runtimePending: "Runtime not verified", prompt: "Read the customer-support-workflow skill, create an urgent ticket for Seabreeze Bookshop's login issue, and explain its category, assignee and SLA.", copy: "Copy chat example", copied: "Copied. Paste the example into chat and send it.", export: "Export local report", exported: "Report exported.", refresh: "Refresh", seed: "Load 4 fake tickets", seeded: "Demo tickets loaded.", loading: "Loading…", updated: "Ticket updated.", total: "All tickets", inProgress: "In progress", waiting: "Waiting", resolved: "Resolved", normal: "Normal", high: "High", urgent: "Urgent", open: "Open", in_progress: "In progress", empty: "No tickets yet. Create one in chat or load fake tickets.", activity: "Recent activity", boundary: "Local data only. No real CRM, messaging, approvals or scheduled tasks."
  }
};
