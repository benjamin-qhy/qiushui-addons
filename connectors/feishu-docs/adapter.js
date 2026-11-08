import { authorization, cli, identity, forget } from "./authorization.js";
function failure(code) { return Object.assign(new Error(code), {code}); }
function profile(input) {return input.credentialMode === "cli-profile" ? input.secret : undefined;}
async function check(input) {
  const user = await identity(input.signal,profile(input));
  if (user.address !== input.address || user.secret !== input.secret) throw failure("CONNECTOR_AUTH_FAILED");
}
export default {authorization,check,async unbind(input) { if (profile(input)) await forget(profile(input)); },async execute(input) {
  await check(input);
  const {action,params={}} = input;
  const args = ["docs","+"+(action==="fetch"?"fetch":action==="append"?"update":"create"),"--as","user","--doc-format","markdown"];
  if(action!=="create") {
    const url = new URL(params.url);
    if(url.protocol!=="https:" || !url.hostname.endsWith(".feishu.cn") || !/^\/docx\/[A-Za-z0-9]+\/?$/.test(url.pathname)) throw failure("CONNECTOR_INVALID_INPUT");
    args.push("--doc",url.pathname.split("/")[2]);
  }
  if(action!=="fetch") {
    if(!params.content || params.content.startsWith("@") || params.content==="-" || params.content.length>64000) throw failure("CONNECTOR_INVALID_INPUT");
    args.push("--content",params.content);
    if(action==="append") args.push("--command","append");
    else args.push("--title",params.title || "海奇文档");
  }
  return (await cli(args,input.signal,profile(input))).data;
}};
