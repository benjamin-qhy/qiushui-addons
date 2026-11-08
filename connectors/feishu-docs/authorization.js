import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ensureCli } from "./install.js";

const run = promisify(execFile);
const root = () => join(process.env.HAIQIAI_HOME || join(homedir(),process.env.HAIQIAI_DEVELOPMENT === "1" ? ".haiqiai-dev" : ".haiqiai"),"connectors","feishu-docs");
const profileName = id => "haiqi-"+id;
const ownProfile = id => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id);
function home(id) {
  if (!ownProfile(id)) throw Error("CONNECTOR_INVALID_PROFILE");
  return join(root(),"profiles",id);
}
async function context(id,signal) {
  if (!id && !(process.env.HAIQIAI_FEISHU_CLI_HOME && process.env.HAIQIAI_FEISHU_CLI_PROFILE)) throw Error("CONNECTOR_AUTH_NOT_CONFIGURED");
  const directory = id ? home(id) : process.env.HAIQIAI_FEISHU_CLI_HOME;
  return {
    bin: id ? await ensureCli(root(),signal) : process.env.HAIQIAI_FEISHU_CLI || "lark-cli",
    profile: id ? profileName(id) : process.env.HAIQIAI_FEISHU_CLI_PROFILE,
    env:{...process.env,...(id ? {LARKSUITE_CLI_CONFIG_DIR:join(directory,".lark-cli"),LARKSUITE_CLI_DATA_DIR:join(directory,"data")} : {}),HOME:directory,USERPROFILE:directory,XDG_CONFIG_HOME:join(directory,"config")}
  };
}
export async function cli(args,signal,id) {
  const {bin,profile,env} = await context(id,signal);
  try {
    const {stdout} = await run(bin,[...args,"--profile",profile],{env,signal,timeout:300000,maxBuffer:4*1024*1024});
    return JSON.parse(stdout);
  } catch { signal?.throwIfAborted(); throw Object.assign(Error("CONNECTOR_FEISHU_REQUEST_FAILED"),{code:"CONNECTOR_FEISHU_REQUEST_FAILED"}); }
}
export async function identity(signal,id) {
  const status = await cli(["auth","status"],signal,id);
  const user = status.identities?.user;
  if (status.identity !== "user" || !user?.openId || user.status !== "ready") throw Object.assign(Error("CONNECTOR_AUTH_FAILED"),{code:"CONNECTOR_AUTH_FAILED"});
  return {address:user.openId,alias:user.userName || "飞书",secret:id || status.appId+"/"+user.openId};
}
export async function forget(id) {
  if (!ownProfile(id)) return;
  const {bin,profile,env} = await context(id);
  await run(bin,["config","remove","--profile",profile],{env,timeout:15000});
  await rm(home(id),{recursive:true,force:true});
}
const attempts = new Map();
export const authorization = {
  origins:["https://open.feishu.cn","https://accounts.feishu.cn"],
  credentialMode:"cli-profile",
  async begin(signal) {
    const id = randomUUID();
    const {bin,env,profile} = await context(id,signal);
    await mkdir(home(id),{recursive:true,mode:0o700});
    const controller = new AbortController();
    const expiresAt = Date.now()+600000;
    const attempt = {controller,result:{status:"pending"}};
    attempts.set(id,attempt);
    const started = Promise.withResolvers();
    const init = spawn(bin,["config","init","--new","--lang","en","--name",profile],{env,signal:controller.signal,stdio:["ignore","pipe","pipe"]});
    let output = "";
    const collect = chunk => {
      output = (output+chunk.toString()).slice(-16000);
      const url = output.match(/https:\/\/open\.feishu\.cn\/[^\s\x1b"'<>]+(?=\s|\x1b)/)?.[0];
      if (url) started.resolve({url,handle:id,expiresAt});
    };
    init.stdout.on("data",collect); init.stderr.on("data",collect);
    const stop = () => controller.abort();
    signal.addEventListener("abort",stop,{once:true});
    const failed = () => {started.reject(Error("CONNECTOR_AUTH_PROVIDER_FAILED"));attempt.result={status:"denied"};};
    init.on("error",failed);
    init.on("close",async code => {
      if (code !== 0 || controller.signal.aborted) return failed();
      try {
        const data = await cli(["auth","login","--scope","docx:document:create docx:document:readonly docx:document:write_only","--no-wait","--json"],controller.signal,id);
        if (!data.device_code || !data.verification_url) throw Error("CONNECTOR_AUTH_PROVIDER_FAILED");
        attempt.result = {status:"pending",url:data.verification_url};
        await cli(["auth","login","--device-code",data.device_code,"--json"],controller.signal,id);
        attempt.result = {status:"verified",credential:await identity(controller.signal,id)};
      } catch { failed(); }
    });
    try { return await started.promise; }
    catch (e) { attempts.delete(id); await rm(home(id),{recursive:true,force:true}); throw e; }
    finally {signal.removeEventListener("abort",stop);}
  },
  async poll(id) {return attempts.get(id)?.result ?? {status:"expired"};},
  async finish(id,connected) {
    const attempt = attempts.get(id);
    if (!attempt) return;
    attempts.delete(id);
    attempt.controller.abort();
    if (!connected) await forget(id);
  }
};
