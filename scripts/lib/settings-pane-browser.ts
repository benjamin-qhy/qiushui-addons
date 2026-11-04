/** Disposable React fixture. Production supplies the real shadcn/Base UI components. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";

export const settingsBrowserEnabled = process.env.QIUSHUIAI_E2E_DISPOSABLE === "1" && !!process.env.QIUSHUIAI_SETTINGS_CORE_SOURCE;

export async function settingsPaneFixture(entry: string, _options: { realHost?: boolean } = {}) {
  const core = process.env.QIUSHUIAI_SETTINGS_CORE_SOURCE!;
  if (!settingsBrowserEnabled || !core.startsWith("/")) throw new Error("Explicit disposable companion core required");
  const { chromium } = await import(join(core, "node_modules/playwright/index.mjs"));
  const root = mkdtempSync(join(tmpdir(), "addon-settings-fixture-"));
  let browser: any;
  let server: ReturnType<typeof Bun.serve> | undefined;
  try {
    const shim = join(root, "entry.ts");
    await Bun.write(shim, `
      import * as React from ${JSON.stringify(join(core, "node_modules/react/index.js"))};
      import {createRoot} from ${JSON.stringify(join(core, "node_modules/react-dom/client.js"))};
      const root=createRoot(document.getElementById('app'));
      const element=(tag,base={})=>({className='',children,...props})=>React.createElement(tag,{...base,...props,className:[base.className,className].filter(Boolean).join(' ')},children);
      const Input=element('input',{className:'settings-addon-control'}),Button=element('button'),Badge=element('span'),Separator=element('hr');
      const Switch=({checked,onCheckedChange,...props})=>React.createElement('button',{...props,type:'button',role:'switch','aria-checked':checked,onClick:()=>onCheckedChange?.(!checked)});
      const Tabs=element('div'),TabsList=element('div',{role:'tablist'}),TabsTrigger=element('button',{role:'tab'}),TabsContent=element('div',{role:'tabpanel'});
      globalThis.__qiushuiaiWeb={React,components:{Badge,Button,Input,Separator,Switch,Tabs,TabsContent,TabsList,TabsTrigger},registerSettingsPane:({component})=>{root.render(React.createElement(component));return()=>root.render(null);},notifySettingsPanesChanged:()=>{}};
      await import('/addon/${entry.split("/").pop()}');
    `);
    const built = await Bun.build({ entrypoints: [shim], target: "browser" });
    if (!built.success) throw new Error(String(built.logs));
    const js = await built.outputs[0]!.text();
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/agent/settings-data") return Response.json({});
      if (url.pathname === "/ui.js") return new Response(js, { headers: { "content-type": "text/javascript" } });
      if (url.pathname.startsWith("/addon/")) {
        const directory = dirname(entry);
        const path = resolve(directory, url.pathname.slice("/addon/".length));
        if (!path.startsWith(directory + "/")) return new Response(null, { status: 404 });
        const file = Bun.file(path);
        if (!await file.exists()) return new Response(null, { status: 404 });
        const extension = extname(path);
        const loader = extension === ".tsx" ? "tsx" : extension === ".ts" ? "ts" : "js";
        return new Response(new Bun.Transpiler({ loader }).transformSync(await file.text()), { headers: { "content-type": "text/javascript" } });
      }
      if (url.pathname.startsWith("/static/") && !url.pathname.includes("..")) {
        const file = Bun.file(join(core, "runtime/web", url.pathname));
        return await file.exists() ? new Response(file) : new Response(null, { status: 404 });
      }
      if (url.pathname !== "/") return new Response("Unexpected fixture request", { status: 404 });
      const skin = url.searchParams.get("skin");
      const modern = skin === "classic" || skin === "visual";
      const cls = modern ? `${skin === "classic" ? "settings-content" : "settings-panel__content"} settings-addon-pane` : "";
      return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${modern ? `<link rel="stylesheet" href="/static/${skin}/css/styles.css">` : ""}<style>:root{--bg-primary:#fff;--bg-secondary:#f7f9fa;--text-primary:#18212a;--text-secondary:#54606c;--border-color:#b7bfc7;--accent-color:#2783b8;--danger-color:#b3261e}body{margin:0;overflow:auto;font:15px system-ui}#app{box-sizing:border-box;max-width:850px;min-height:0;padding:12px;overflow:visible}</style></head><body><main id="app" class="${cls}"></main><script type="module" src="/ui.js"></script></body></html>`, { headers: { "content-type": "text/html" } });
    } });
    browser = await chromium.launch({ headless: true });
    return {
      async page(skin: string, width = 390, colorScheme: "light" | "dark" = "light") {
        const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error: Error) => errors.push(error.message));
        await page.route("**/*", (route: any) => new URL(route.request().url()).origin === server!.url.origin ? route.continue() : route.abort());
        return { page, errors, url: server!.url.href + "?skin=" + skin };
      },
      async close() { await browser.close(); server!.stop(true); rmSync(root, { recursive: true, force: true }); },
    };
  } catch (error) { await browser?.close(); server?.stop(true); rmSync(root, { recursive: true, force: true }); throw error; }
}
