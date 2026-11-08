import { access, chmod, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const version = "1.0.99";
const checksums = {
  "lark-cli-1.0.99-darwin-amd64.tar.gz": "31f900409082728761346a94b7b81038c78b302883b69c36b849b23d843d7de1",
  "lark-cli-1.0.99-darwin-arm64.tar.gz": "f24f4106d1b0b1a4ee9a24ec0953dee6e518476bbe3d9758f78a732477525b21",
  "lark-cli-1.0.99-linux-amd64.tar.gz": "fd29f51030dde6919b6ca9173bc87852d3846f253d198022ea2d9ee63527b945",
  "lark-cli-1.0.99-linux-arm64.tar.gz": "2837145e72922d558538494d0da30ac6c509681fc0791f8818f4ddb87f5125b4",
  "lark-cli-1.0.99-linux-riscv64.tar.gz": "31bed6e817b3446609db7cfa6d82a501494ff60644a8c736ded918fc407c937c",
  "lark-cli-1.0.99-windows-amd64.zip": "1b43cb63ff533ee067db45d93a862074d147df5a0d05f95c2d2a7c70c3f97375",
  "lark-cli-1.0.99-windows-arm64.zip": "6ce96dd8559ef7e0a2b4e228b81a955e3df71e6e19f2d2070b65df232b4ae8a4"
};
let installing;
export async function ensureCli(root, signal) {
  const directory = join(root, "cli", version);
  const binary = "lark-cli" + (process.platform === "win32" ? ".exe" : "");
  const target = join(directory, binary);
  try { await access(target); return target; } catch (e) { if (e.code !== "ENOENT") throw e; }
  if (!installing) installing = install().finally(() => { installing = undefined; });
  return installing;
  async function install() {
    const platform = process.platform === "win32" ? "windows" : process.platform;
    const arch = process.arch === "x64" ? "amd64" : process.arch;
    const archive = "lark-cli-"+version+"-"+platform+"-"+arch+(platform === "windows" ? ".zip" : ".tar.gz");
    if (!checksums[archive]) throw Error("CONNECTOR_PLATFORM_UNSUPPORTED");
    await mkdir(directory,{recursive:true,mode:0o700});
    const temp = await mkdtemp(join(directory,"install-"));
    try {
      const path = join(temp,archive);
      let verified = false;
      for (const base of ["https://github.com/larksuite/cli/releases/download/v"+version, "https://registry.npmmirror.com/-/binary/lark-cli/v"+version]) {
        try {
          await run("curl",["--proto","=https","--proto-redir","=https","--fail","--location","--silent","--max-time","45","--max-filesize","100000000","--output",path,base+"/"+archive],{signal});
          verified = createHash("sha256").update(await readFile(path)).digest("hex") === checksums[archive];
          if (verified) break;
        } catch { signal?.throwIfAborted(); }
      }
      if (!verified) throw Error("CONNECTOR_CLI_DOWNLOAD_FAILED");
      await run("tar",["-xf",path,"-C",temp],{signal});
      await chmod(join(temp,binary),0o700);
      await rename(join(temp,binary),target);
      return target;
    } finally { await rm(temp,{recursive:true,force:true}); }
  }
}
