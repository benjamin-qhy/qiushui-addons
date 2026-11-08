# 员工隔离版客户工单助手

将现有 `qiushuiai-addons/addons/customer-support-demo` 的 `CustomerSupportService` 和配置逻辑接入员工实例协议。保留 MIT 许可证；领域源码来源：https://github.com/benjamin-qhy/qiushuiai-addons/tree/main/addons/customer-support-demo 。此版本不连接 CRM，不发送外部消息。

将完整目录实体安装到员工 `capabilities/addons/customer-support-isolated/`，经内容校验和批准后使用。`instance.ts` 在独立进程中创建服务和持久 KV；`web.tsx` 通过宿主 React、shadcn 和只允许当前实例的 request 展示同一服务。不是全局注册表的别名，不加载原插件的全局桥接。

工具支持创建、列出、关闭和汇总工单。页面能刷新及关闭工单；页面和工具使用相同实例。每个员工、内容版本、配置版本有独立数据目录，更新不会直接覆盖旧实例状态。
