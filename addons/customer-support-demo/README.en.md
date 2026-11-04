# Customer Support Add-on Demo

A fictional customer-support office: Skill = playbook, Extension = worker, settings = defaults, workbench = ticket board, Package = the entire kit.

- Introduction: Settings → Add-ons → Details; navigation only.
- Configuration: Settings → Customer support.
- Business UI: Chat → Workbench → Support workbench.
- Actual usage: select the globally installed add-on in Project configuration, then ask the assistant to create, update, close or report on tickets in a fresh chat.

Local development uses a source snapshot, not a package-root symlink:

```bash
bun run addon:dev customer-support-demo --home /your/isolated/home
bun run addon:verify customer-support-demo
```

Rerun after edits, restart the isolated host and open a new chat. Nothing is published.
The demo requires the matching host KV declarations and React/shadcn web contract.
No real CRM, outgoing messages, approvals, attachment system or scheduled tasks are implemented.

See [the illustrated walkthrough](README.md) and [acceptance evidence](ACCEPTANCE.md).
