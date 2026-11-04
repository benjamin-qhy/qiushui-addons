# Piclaw Add-on 界面与实际使用调研

核对时间：2026-09-21。当前上游主分支：[`piclaw-addons@783c673`](https://github.com/rcarmo/piclaw-addons/commit/783c673993271647eec96597e02eede1f72f1036)、[`piclaw@7a38db6`](https://github.com/rcarmo/piclaw/commit/7a38db66a4dc16200a050054c1a58c4ef6ff853b)。

## 结论

### 界面分别属于谁

- 截图最外层的 Add-on 详情弹窗、名称、说明、分类和主页链接属于 QiushuiAI 主项目。
- 里面的“工单看板 / 插件设置 / 能力说明”来自 `customer-support-demo/web/index.tsx`，属于 Add-on 包。
- QiushuiAI 主项目只提供 React、shadcn 组件、加载器和挂载位置。

Piclaw 上游也是宿主加载 `pi.web.entries`，再由 Add-on 注册具体界面。[宿主 Web API 和加载器](https://github.com/rcarmo/piclaw/blob/7a38db66a4dc16200a050054c1a58c4ef6ff853b/runtime/web/src/ui/addon-web-extensions.ts#L139-L190)

### SettingsPane 应该做什么

上游把职责分为三层：

1. **Add-Ons 页面**：安装、升级、卸载和基本信息。
2. **SettingsPane**：真实配置操作；普通配置走 Add-on config API/KV，密钥走 Keychain。
3. **聊天工具、Skill 或专用工作区面板**：真正使用业务能力。

`sample-addon` 的 SettingsPane 可以启停、修改 greeting、保存密钥，不是纯介绍页；同时它明确提示用户去聊天调用 `sample_test` 验证实际功能。[设置实现](https://github.com/rcarmo/piclaw-addons/blob/783c673993271647eec96597e02eede1f72f1036/addons/sample-addon/web/index.ts#L44-L160)、[使用说明](https://github.com/rcarmo/piclaw-addons/blob/783c673993271647eec96597e02eede1f72f1036/addons/sample-addon/README.md#L79-L97)

因此，当前示例把配置、业务看板和能力介绍都塞进 Add-on 详情弹窗，能运行，但职责混在了一起。业务看板更适合独立工作区面板；详情页只说明用途和使用入口；设置页只保留配置。

## 当前示例实际验证到哪里

> 下列为修改前的调研快照。2026-09-21 后续已完成入口拆分和三个真实模型会话验收，最新结果见 [客户工单助手验收记录](addons/customer-support-demo/ACCEPTANCE.md)。

已经验证：

- 包能安装并加载 Web 入口；
- `support_ticket` 被 Extension 注册；
- 工单服务的 create/list/close 等函数可执行；
- 配置、看板、导出 API 可调用；
- 看板可以载入 4 条演示数据并显示。

尚未验证：

- 用户在真实聊天中发消息后，模型是否实际调用 `support_ticket`；
- `customer-support-workflow` Skill 是否被发现并影响模型处理流程；
- 聊天创建的工单是否立即出现在看板；
- 看板修改后，聊天查询是否读到同一状态；
- 新聊天能否继续看到全局工单，同时保持会话调用计数隔离。

所以目前只能证明“安装、配置和 Web 面板工作”，不能证明“用户已经可以通过主要入口完整使用插件”。

## 推荐验收

1. 在真实新聊天中发送“请把海风书店的登录故障记成紧急工单，并告诉我工单编号”。
2. 断言时间线出现 `support_ticket` 工具调用，并返回真实工单号。
3. 打开看板，断言同一个工单、客户、优先级和状态可见。
4. 在聊天中更新或关闭工单，再确认看板同步变化。
5. 新建第二个聊天，确认全局工单仍存在，但 `sessionCalls` 分开统计。
6. 将以上流程固化为可重复的 Runtime 集成测试和浏览器 E2E，而不是直接调用内部函数代替聊天。

上游 `vent` 也采用“设置只决定输出位置，工具实际写入工作区文件”的分工，并测试最终文件内容，而不是只测安装成功。[Vent 用法](https://github.com/rcarmo/piclaw-addons/blob/783c673993271647eec96597e02eede1f72f1036/addons/vent/README.md#L20-L73)、[结果测试](https://github.com/rcarmo/piclaw-addons/blob/783c673993271647eec96597e02eede1f72f1036/addons/vent/index.test.ts#L24-L35)

一句话推荐：**详情页说明“是什么”，设置页决定“怎么运行”，聊天或独立工作台完成“真正使用”。**
