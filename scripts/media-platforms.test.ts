import { beforeEach, afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mediaPlatforms } from "../pi-extensions/media-platforms/index.js";
import type { MediaConfiguration, MediaPlatformContext, MediaRequest } from "../pi-extensions/media-platforms/contracts.js";
async function readAsset(asset: import("../pi-extensions/media-platforms/contracts.js").MediaAsset, signal: AbortSignal) {
  if (asset.source.type !== "stream") throw new Error("Expected stream asset");
  return new Uint8Array(await new Response(await asset.source.open(signal)).arrayBuffer());
}
function setEnv(values: Record<string, string>) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  return () => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } };
}
beforeEach(() => { cleanups.push(setEnv({NO_PROXY: "127.0.0.1,localhost,::1", no_proxy: "127.0.0.1,localhost,::1"})); });
const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });
function fixture(handler: (request: Request) => Promise<Response> | Response) {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: handler });
  cleanups.push(() => server.stop(true));
  return String(server.url).replace(/\/$/, "");
}
function context(baseUrl: string, capability: MediaConfiguration["capability"], model: string): MediaPlatformContext {
  return { configuration: { id: capability + ".test", platform: "test", capability, model, baseUrl, region: "", appId: "", resourceId: "", voiceId: "voice", credentialRef: "", revision: 1, updatedAt: new Date().toISOString() }, secret: "test-secret", signal: new AbortController().signal };
}
function input(capability: MediaRequest["capability"]): MediaRequest { return { capability, prompt: "hello", inputFiles: [] }; }
function temporary() { const root = mkdtempSync(join(tmpdir(), "haiqiai-platform-")); cleanups.push(() => rmSync(root, { recursive: true, force: true })); return root; }
const [bailian, volcengine, cli] = mediaPlatforms;

test("CLIProxyAPI preserves versioned endpoint and sends multipart references", async () => {
  let calls = 0;
  const root = temporary(), path = join(root, "input-0"); writeFileSync(path, "test-image");
  const url = fixture(async req => {
    calls++; expect(req.headers.get("authorization")).toBe("Bearer test-secret");
    if (new URL(req.url).pathname.endsWith("/edits")) { const form = await req.formData(); expect(form.get("model")).toBe("gpt-image-2"); expect(form.getAll("image[]")).toHaveLength(1); const image = form.get("image[]") as File; expect(image.type).toBe("image/png"); expect(image.name).toBe("reference-1.png"); expect(await image.text()).toBe("test-image"); }
    else { expect(new URL(req.url).pathname).toBe("/v1/images/generations"); expect(await req.json()).toMatchObject({ prompt: "hello" }); }
    return Response.json({ data: [{ b64_json: Buffer.from("image").toString("base64") }] });
  });
  const ctx = context(url + "/v1", "image", "gpt-image-2");
  const generated = await cli!.submit(input("image"), ctx);
  expect(generated.state).toBe("complete");
  await cli!.submit({ ...input("image"), inputFiles: [{ path, contentType: "image/png" }] }, ctx);
  expect(calls).toBe(2);
});

test("Bailian persists video ID and queries without another submit", async () => {
  const paths: string[] = [];
  const url = fixture(async req => { paths.push(new URL(req.url).pathname); if (req.method === "POST") { expect(req.headers.get("x-dashscope-async")).toBe("enable"); return Response.json({ output: { task_id: "video-id", task_status: "PENDING" } }); } return Response.json({ output: { task_id: "video-id", task_status: "SUCCEEDED", video_url: "https://example.com/video.mp4" } }); });
  const ctx = context(url, "video", "wan3.0-video");
  expect(await bailian!.submit(input("video"), ctx)).toMatchObject({ state: "pending", externalId: "video-id" });
  expect(await bailian!.query!("video-id", ctx)).toMatchObject({ state: "complete", externalId: "video-id" });
  expect(paths).toEqual(["/api/v1/services/aigc/video-generation/video-synthesis", "/api/v1/tasks/video-id"]);
});

test("Bailian music sends lyrics or instrumental prompt and saves lyrics separately", async () => {
  const bodies: unknown[] = [];
  const url = fixture(async req => { bodies.push(await req.json()); return Response.json({ output: { audio: { url: "https://example.com/music.mp3" }, extra_info: { lyrics: "words" } } }); });
  const ctx = context(url, "music", "fun-music-v1");
  const result = await bailian!.submit({ ...input("music"), lyrics: "sing this" }, ctx);
  expect(result.state === "complete" && result.assets.length).toBe(2);
  await bailian!.submit({ ...input("music"), lyrics: "ignored", instrumental: true }, ctx);
  expect(bodies).toEqual([{ model: "fun-music-v1", input: { lyrics: "sing this", is_instrumental: false, format: "mp3" } }, { model: "fun-music-v1", input: { prompt: "hello", is_instrumental: true, format: "mp3" } }]);
});

test("Volcengine streams split JSON audio chunks and rejects late error frames", async () => {
  let failure = false;
  const url = fixture(async req => {
    expect(req.headers.get("x-api-key")).toBe("test-secret");
    expect(await req.json()).toMatchObject({ req_params: { speaker: "voice", text: "hello" } });
    const lines = JSON.stringify({ code: 0, data: "AQID" }) + "\n" + JSON.stringify(failure ? { code: 45000000 } : { code: 20000000 });
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(lines.slice(0, 7))); controller.enqueue(new TextEncoder().encode(lines.slice(7))); controller.close(); } }));
  });
  const ctx = context(url, "tts", "seed-tts-2.0-standard");
  const result = await volcengine!.submit(input("tts"), ctx);
  if (result.state !== "complete") throw new Error("Expected complete response");
  expect((await readAsset(result.assets[0]!, ctx.signal)).length).toBe(3);
  failure = true;
  await expect(readAsset(result.assets[0]!, ctx.signal)).rejects.toThrow("MEDIA_PLATFORM_FAILED");
});

test("voice enrollment uses vendor-specific bodies and never implicitly allocates a paid slot", async () => {
  const root = temporary(), path = join(root, "voice.wav"); writeFileSync(path, "sample");
  const url = fixture(async req => {
    const body = await req.json() as Record<string, unknown>;
    if (req.url.endsWith("voice_clone")) { expect(body.speaker_id).toBe("S_existing"); expect(body.audio).toMatchObject({ format: "wav" }); return Response.json({ speaker_id: "S_existing", status: 2 }); }
    expect(body).toMatchObject({ model: "qwen-voice-enrollment", input: { action: "create", target_model: "qwen3-tts-vc-realtime-2026-01-15" } });
    return Response.json({ output: { voice: "qwen-voice" } });
  });
  const sample = { path, contentType: "audio/wav", name: "My voice" };
  expect(await bailian!.cloneVoice!(sample, context(url, "tts", "qwen3-tts-vc-realtime-2026-01-15"))).toMatchObject({ id: "qwen-voice", state: "ready" });
  const ctx = context(url, "tts", "seed-tts-2.0-standard");
  await expect(volcengine!.cloneVoice!(sample, ctx)).rejects.toThrow("MEDIA_CLONE_SLOT_REQUIRED");
  expect(await volcengine!.cloneVoice!({ ...sample, voiceId: "S_existing" }, ctx)).toMatchObject({ id: "S_existing", state: "ready" });
});

test("auth failures expose only a stable code, never platform response contents", async () => {
  const url = fixture(() => new Response("secret provider diagnostics", { status: 401 }));
  await expect(cli!.submit(input("image"), context(url, "image", "gpt-image-2"))).rejects.toThrow("MEDIA_AUTH_FAILED");
});

test('Qwen clone synthesis uses authenticated WebSocket and returns complete PCM with format metadata',async()=>{
 const received:string[]=[];
 const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(req,server){
  expect(req.headers.get('authorization')).toBe('Bearer test-secret');
  expect(new URL(req.url).searchParams.get('model')).toBe('qwen3-tts-vc-realtime-2026-01-15');
  if(server.upgrade(req))return;return new Response(null,{status:400});
 },websocket:{message(ws,message){const event=JSON.parse(String(message));received.push(event.type);
  if(event.type==='session.update'){expect(event.session).toMatchObject({voice:'voice',sample_rate:24000,speech_rate:1.25,volume:40});ws.send(JSON.stringify({type:'session.updated'}));}
  if(event.type==='session.finish'){ws.send(JSON.stringify({type:'response.audio.delta',delta:Buffer.from([1,0,2,0]).toString('base64')}));ws.send(JSON.stringify({type:'session.finished'}));}
 }}});
 cleanups.push(()=>server.stop(true));
 const ctx=context(String(server.url).replace(/\/$/,''),'tts','qwen3-tts-vc-realtime-2026-01-15');
 ctx.configuration={...ctx.configuration,speechRate:1.25,volume:80};
 const result=await bailian!.submit(input('tts'),ctx);
 if(result.state!=='complete')throw new Error('Expected stream');
 expect((await readAsset(result.assets[0]!, ctx.signal)).length).toBe(4);
 expect(result.assets[0]!.pcm).toMatchObject({sampleRate:24000,channels:1,bits:16});
 expect(received).toEqual(['session.update','input_text_buffer.append','input_text_buffer.commit','session.finish']);
});

test('successful Bailian responses may contain an empty error code',async()=>{
 const url=fixture(()=>Response.json({code:'',output:{audio:{url:'https://example.com/speech.wav'}}}));
 expect((await bailian!.submit(input('tts'),context(url,'tts','qwen3-tts-flash'))).state).toBe('complete');
});

test("Volcengine applies saved speech speed and volume to streamed audio", async () => {
 const url=fixture(async req=>{expect(await req.json()).toMatchObject({req_params:{audio_params:{speech_rate:25,loudness_rate:-20}}});return new Response(JSON.stringify({code:0,data:Buffer.from("audio").toString("base64")})+"\n"+JSON.stringify({code:20000000})+"\n");});
 const ctx=context(url,"tts","seed-tts-2.0-standard");ctx.configuration={...ctx.configuration,speechRate:1.25,volume:80};
 const result=await volcengine!.submit(input("tts"),ctx);
 if(result.state!=="complete")throw new Error("Expected stream");
 expect((await readAsset(result.assets[0]!,ctx.signal)).length).toBe(5);
});
