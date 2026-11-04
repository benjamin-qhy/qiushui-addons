#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const slug = process.argv[2]?.trim();
if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error("用法：bun run addon:verify <slug>");
  process.exit(1);
}
const addonRoot = resolve(repoRoot, "addons", slug);
if (addonRoot !== join(repoRoot, "addons", slug) || !existsSync(join(addonRoot, "package.json"))) throw new Error(`找不到 addons/${slug}`);
const manifest = JSON.parse(readFileSync(join(addonRoot, "package.json"), "utf8"));
const declared = [manifest.main, ...(manifest.pi?.extensions || []), ...(manifest.pi?.web?.entries || []), ...(manifest.pi?.runtime?.entries || [])].filter(Boolean);
for (const entry of declared) if (!existsSync(join(addonRoot, entry))) throw new Error(`缺少声明文件：${entry}`);

await run(["bun", "test", addonRoot], repoRoot, "自动化测试");
await run(["bun", "pm", "pack", "--dry-run"], addonRoot, "打包预检");
console.log(`✓ ${manifest.name}@${manifest.version} 验证通过；没有发布任何内容。`);

async function run(command: string[], cwd: string, label: string): Promise<void> {
  console.log(`→ ${label}`);
  const process = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit", stdin: "inherit" });
  const code = await process.exited;
  if (code !== 0) throw new Error(`${label}失败（退出码 ${code}）`);
}
