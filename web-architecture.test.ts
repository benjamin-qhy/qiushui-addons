import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const slugs = ["customer-support-demo", "observability", "sample-addon", "vent"];

test("every first-party Add-on Web entry uses the React + shadcn host contract", () => {
  for (const slug of slugs) {
    const manifest = JSON.parse(readFileSync(join(import.meta.dir, "addons", slug, "package.json"), "utf8"));
    expect(manifest.pi.web.entries).toEqual(["web/index.tsx"]);
    const entry = join(import.meta.dir, "addons", slug, "web", "index.tsx");
    expect(existsSync(entry)).toBe(true);
    const source = readFileSync(entry, "utf8");
    const hostModule = join(import.meta.dir, "addons", slug, "web", "host.ts");
    const hostSource = existsSync(hostModule) ? readFileSync(hostModule, "utf8") : source;
    expect(hostSource).toContain("__qiushuiaiWeb");
    if (hostSource !== source) expect(source).toContain('from "./host.ts"');
    expect(source).toContain("host.components");
    expect(source).not.toMatch(/preact|__qiushuiaiPreact|__qiushuiaiSettingsPaneRegistry|__qiushuiai_web|\bhtm\b/i);
    expect(hostSource).not.toMatch(/preact|__qiushuiaiPreact|__qiushuiaiSettingsPaneRegistry|__qiushuiai_web|\bhtm\b/i);
  }
});
