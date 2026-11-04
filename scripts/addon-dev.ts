#!/usr/bin/env bun
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const slug = process.argv[2]?.trim();
if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error("用法：bun run addon:dev <slug> [--home <QIUSHUIAI_HOME>]");
  process.exit(1);
}

const homeFlag = process.argv.indexOf("--home");
const devHome = resolve(homeFlag >= 0 && process.argv[homeFlag + 1] ? process.argv[homeFlag + 1]! : process.env.QIUSHUIAI_HOME || join(homedir(), ".qiushuiai-dev"));
const source = resolve(repoRoot, "addons", slug);
if (source !== join(repoRoot, "addons", slug) || !existsSync(join(source, "package.json"))) {
  console.error(`找不到 Add-on：addons/${slug}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8")) as { name?: string; version?: string };
if (!manifest.name?.startsWith("@qiushuiai/qiushuiai-addon-")) throw new Error("package.json 中缺少合法的 QiushuiAI Add-on 包名");
const packageLeaf = manifest.name.split("/")[1]!;
const addonsRoot = join(devHome, "system", "addons");
const scopeRoot = join(addonsRoot, "node_modules", "@qiushuiai");
const target = join(scopeRoot, packageLeaf);
mkdirSync(scopeRoot, { recursive: true });

let backup: string | null = null;
if (existsSync(target) || lstatSafe(target)) {
  {
    const backupRoot = join(addonsRoot, "dev-backups");
    mkdirSync(backupRoot, { recursive: true });
    backup = join(backupRoot, `${packageLeaf}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    renameSync(target, backup);
  }
}
// The host deliberately rejects package-root symlinks in task capabilities.
// Publish a local snapshot instead of bypassing its containment protection.
cpSync(source, target, { recursive: true, dereference: false, filter: path => basename(path) !== "node_modules" });

const rootManifestPath = join(addonsRoot, "package.json");
const rootManifest = existsSync(rootManifestPath) ? JSON.parse(readFileSync(rootManifestPath, "utf8")) : { name: "qiushuiai-local-addons", private: true, dependencies: {} };
rootManifest.private = true;
rootManifest.dependencies ||= {};
rootManifest.dependencies[manifest.name] = `file:${source}`;
writeFileSync(rootManifestPath, `${JSON.stringify(rootManifest, null, 2)}\n`);

console.log(`已安装本地源码快照：${source} -> ${target}`);
console.log(`开发数据目录：${devHome}`);
if (backup) console.log(`原安装已备份：${backup}`);
console.log("这不是公开发布。修改源码后再次运行本命令，再重启 QiushuiAI 开发实例；无需提交或上传。");
console.log(`启动命令（在 QiushuiAI 仓库）：QIUSHUIAI_HOME=${devHome} bun run dev`);

function lstatSafe(path: string): boolean {
  try { lstatSync(path); return true; } catch { return false; }
}
