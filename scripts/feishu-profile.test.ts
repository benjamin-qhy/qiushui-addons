import { test, expect } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Use a fixture executable to observe the *actual child process* profile and HOME.
// No Feishu tokens or network calls are used.
test.skipIf(process.platform === "win32")("each binding checks and invokes its own CLI profile, including after another binding is removed", async () => {
  const root=mkdtempSync(join(tmpdir(),"haiqi-profile-"));
  const old=process.env.HAIQIAI_HOME;
  try {
    process.env.HAIQIAI_HOME=root;
    const base=join(root,"connectors","feishu-docs");
    const bin=join(base,"cli","1.0.99","lark-cli");
    mkdirSync(join(base,"cli","1.0.99"),{recursive:true});
    writeFileSync(bin,`#!/usr/bin/env node
const fs=require("node:fs"),path=require("node:path");
const id=path.basename(process.env.HOME), profile=process.argv.at(-1);
if(profile!=="haiqi-"+id)process.exit(1);
if(process.argv[2]==="auth") console.log(JSON.stringify({identity:"user",identities:{user:{openId:id,userName:id,status:"ready"}}}));
else console.log(JSON.stringify({data:{user:id}}));
`); chmodSync(bin,0o700);
    const url = new URL("../connectors/feishu-docs/adapter.js",import.meta.url);
    const adapter=(await import(url.href)).default;
    const account=()=>{const id=randomUUID();mkdirSync(join(base,"profiles",id),{recursive:true});return {credentialMode:"cli-profile",secret:id,address:id,action:"fetch",params:{url:"https://example.feishu.cn/docx/abc"}};};
    const a=account(),b=account();
    expect(await Promise.all([adapter.execute(a),adapter.execute(b)])).toEqual([{user:a.address},{user:b.address}]);
    await expect(adapter.execute({...b,secret:a.secret})).rejects.toThrow("CONNECTOR_AUTH_FAILED");
    await adapter.unbind(a);
    expect(existsSync(join(base,"profiles",a.secret))).toBe(false);
    expect(await adapter.execute(b)).toEqual({user:b.address});
  } finally {
    if(old === undefined) delete process.env.HAIQIAI_HOME; else process.env.HAIQIAI_HOME=old;
    rmSync(root,{recursive:true,force:true});
  }
});
