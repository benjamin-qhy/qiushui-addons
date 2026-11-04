import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resources } from "./translations.ts";

test("settings and workspace are separate React registrations with API-backed runtime status", () => {
  const source = readFileSync(join(import.meta.dir, "index.tsx"), "utf8");
  const api = readFileSync(join(import.meta.dir, "api.ts"), "utf8");
  expect(source).toContain("host.registerSettingsPane");
  expect(source).toContain("host.registerWorkspacePane");
  expect(source).toContain("api.runtime()");
  expect(source).toContain("FieldLabel");
  expect(source).not.toContain("fetch(");
  expect(source).not.toMatch(/preact|htm`|__qiushuiaiPreact/i);
  expect(api).toContain("/agent/keychain");
  expect(Object.keys(resources["zh-CN"]).sort()).toEqual(Object.keys(resources["en-US"]).sort());
});
