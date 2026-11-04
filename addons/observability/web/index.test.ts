import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dir, "index.tsx"), "utf8");

test("observability web entry only registers the settings pane", () => {
  expect(source).toContain("registerSettingsPane");
  expect(source).toContain("__qiushuiaiWeb");
  expect(source).not.toMatch(/preact|htm`|__qiushuiaiPreact/i);
  expect(source).not.toContain("APP_INSIGHTS_SDK_URL");
  expect(source).not.toContain("browser-config");
  expect(source).not.toContain("EventSource");
  expect(source).not.toContain("window.fetch");
  expect(source).not.toContain("trackEvent");
  expect(source).not.toContain("trackPageView");
});

test("settings pane no longer exposes browser telemetry controls", () => {
  expect(source).not.toContain("appinsights_browser_enabled");
  expect(source).not.toContain("Browser agent telemetry");
});
