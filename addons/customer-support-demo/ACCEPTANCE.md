# 客户工单助手：真实使用验收

验收时间：2026-09-21；版本：0.1.1；PC Web，模型 `openai-codex/gpt-5.5`。

## 结论

不是只安装成功：实际聊天读取了 Skill、调用了工具，工单写入本地存储，工作台读取同一份数据。设置、业务工作台和插件介绍已分开。使用宿主 React + TypeScript + shadcn/Base UI，没有 Preact/HTM。

本次使用独立测试目录，用户明确批准复用现有 Codex 登录；凭据只导入测试环境的加密凭据库，没有写入本仓库或输出明文。

## 三个聊天分别证明了什么

| 会话 | 实际操作 | 看得见、可核对的结果 |
| --- | --- | --- |
| 海风书店紧急工单 | 读取 Skill、分类/优先级规则；create | CS-0001，account/urgent，负责人为设置中的“验收客服”，时限恰好 3 小时 |
| 同一会话 | get、update、list、summary | 工单改为处理中，负责人小水；工作台同步显示 |
| 同一会话 | 读取回复模板、runtime_status、report | 草稿未发送；Runtime 返回真实待处理数；生成并交付可下载 Markdown 文件 |
| 同一会话，重启后 | get、close、summary | 工单仍在；关闭后 resolved=1、待处理=0；会话计数继续到 10 |
| 同一会话，设置关闭后 | 尝试创建“禁止写入测试” | 工具明确拒绝；没有新增工单。随后恢复启用 |
| 工单插件生命周期验收 | list、明确确认 reset_demo、seed_demo、summary、runtime_status | 先读到上个会话已解决工单，再清空测试工单，载入 4 条假数据；独立会话计数 1–5 |
| 查询工单状态负责人 | get CS-0003、summary | 读到在工作台手动修改的 in_progress / 小秋；工具正文返回 sessionCalls=1、2 |

这也验证了两个方向：**聊天改，页面能看到；页面改，聊天能读到。**重置只作用于隔离环境中的虚拟工单，未动正式数据；重置前的聊天记录与导出报告保留。重置后编号会重新从 CS-0001 开始，所以截图不同时段的同一编号不代表同一条历史记录。

## 配置与安全

- 设置页保存默认负责人和 3 小时紧急时限，真实聊天建单确认生效。
- 假 CRM 密钥通过 Keychain 保存，刷新后只显示已保存，不回显密钥；本例不使用它连接第三方。
- 普通配置和工单存在全局 KV；三个聊天计数分别为 10、5、2，不混用 Pi session UUID。
- Runtime 状态来自宿主注册的状态提供者，不用固定“已加载”文案冒充成功。
- 已检查中文浅色、英文深色设置页。用户输入的团队名、客户名不会自动翻译。

## 证据

- [聊天创建/更新与工作台](assets/chat-workbench.png)
- [停用后聊天拒绝执行](assets/disabled-chat.png)
- [工作台改动被新聊天读到](assets/chat-ui-sync.png)
- [独立设置页](assets/settings.png)
- [仅介绍与入口的详情弹窗](assets/details.png)；“设置”按钮已验证跳转独立设置页
- [英文深色设置页](assets/settings-en-dark.png)
- [脱敏工具调用摘录](assets/chat-evidence.json)

本机原始日志位于隔离根 `/tmp/qiushuiai-customer-support-demo-e2e-DfKN17/data/sessions/`，三个会话 ID：

```text
web:branch-1b539487-ec1d-4cac-af15-60c6b4977272
web:branch-98f73896-d926-43ee-b751-418ca912dd5b
web:branch-97b3edb5-127a-4b6e-bfbb-ed9ab9099c53
```

真实交付文件：隔离根下 `workspace/customer-support-report.md`，346 字节；SHA-256：`6593057a035d3adbdec93b93722c6f60fe44d84a0c3646972177cdf85f5892d1`。它是重置之前那条工单的报告，不是最后四条演示工单的报告。

## 自动化检查

| 检查 | 结果 |
| --- | --- |
| QiushuiAI 客户端完整测试 | 132 个文件、968 项通过；之后新增的工作台去重回归所在文件 15 项通过 |
| QiushuiAI typecheck / build:web | 通过；构建保留现有大分块警告 |
| Runtime Web 资源、Runtime 贡献、安装快照、KV 持久化 | 29 项通过 |
| Demo addon:verify（含打包预检） | 9 项通过，未发布 |
| Add-ons 兼容测试 | 42 项通过，3 项可选 sample 浏览器测试跳过 |
| 独立包导入 | customer-support-demo、observability、sample-addon、vent 均通过 |
| Web 架构与本地快照安装回归 | 2 项通过 |
| Add-ons typecheck:earendil-compat / check:catalog | 通过 |

真实模型验收是本次浏览器实测，不伪装成每次 CI 都会运行的自动化 E2E。复测步骤和可复制提示词见 [README](README.md)。

## 这份示例的边界

已展示 Package、Extension 工具与生命周期、Skill 及资料模板、独立设置与工作台、配置 API、全局/会话 KV、Keychain、按需 Runtime 状态和文件产物。

它不是 Piclaw 每一个 API 的集合：通道消息、跨实例消息、外部 HTTP 路由、音视频流未实现/未验收。真实 CRM、消息发送、多人审批、附件、复杂搜索、后台定时任务和真实客户数据均按约定不做。没有提交、推送或公开发布。
