import { expect, test } from "bun:test";
import { lstatSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("local development installs a contained snapshot and backs up the previous copy outside discovery", () => {
  const home = mkdtempSync(join(tmpdir(), "addon-dev-snapshot-"));
  const install = () => Bun.spawnSync([process.execPath, "scripts/addon-dev.ts", "customer-support-demo", "--home", home], { cwd: import.meta.dir });
  expect(install().exitCode).toBe(0);
  const root = join(home, "system/addons");
  const target = join(root, "node_modules/@qiushuiai/qiushuiai-addon-customer-support-demo");
  expect(lstatSync(target).isSymbolicLink()).toBe(false);
  expect(readFileSync(join(target, "index.ts"), "utf8")).toBe(readFileSync(join(import.meta.dir, "addons/customer-support-demo/index.ts"), "utf8"));
  expect(install().exitCode).toBe(0);
  expect(readdirSync(join(root, "dev-backups"))).toHaveLength(1);
  expect(readdirSync(join(root, "node_modules/@qiushuiai"))).toEqual(["qiushuiai-addon-customer-support-demo"]);
  expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies["@qiushuiai/qiushuiai-addon-customer-support-demo"]).toStartWith("file:");
});
