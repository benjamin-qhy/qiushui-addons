---
name: customer-support-workflow
description: 用客户工单助手示例完成工单分类、定优先级、创建、跟进、关闭和汇总。当用户提到客服问题、客户投诉、工单或售后记录时使用。
---

# 客户工单处理流程

这是一个教学 Skill。它告诉 AI “客服工单应该怎么处理”，但不会自己连接 CRM 或发送消息。

1. 先用一句话复述客户的问题，不要编造没有提供的事实。
2. 参考 `references/category-rules.md` 选择分类。
3. 参考 `references/priority-rules.md` 选择优先级。
4. 需要保存时调用 `support_ticket`；缺少客户名称或标题时先询问。
5. 更新或关闭前先读取工单，说明将改变什么。
6. 只有用户明确要求清空数据时，才用 `reset_demo` 且传入 `confirm: true`。
7. 需要回复客户时，以 `assets/reply-template.md` 为骨架生成草稿；明确标注“草稿”，不要声称已经发送。

本示例的所有客户和工单都是虚构数据。
