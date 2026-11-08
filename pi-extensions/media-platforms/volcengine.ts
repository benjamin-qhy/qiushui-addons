import { randomUUID } from "node:crypto";
import { MediaError, type MediaPlatform, type MediaPlatformContext, type MediaAsset } from "./contracts.js";
import { dataUrl, images, object, request, response, string, urlAsset } from "./http.js";
function endpoint(context: MediaPlatformContext): string {
  return context.configuration.baseUrl || (["stt", "tts"].includes(context.configuration.capability) ? "https://openspeech.bytedance.com" : "https://ark.cn-beijing.volces.com/api/v3");
}
function speechHeaders(context: MediaPlatformContext): Record<string, string> {
  return { "Content-Type": "application/json", "X-Api-Key": context.secret, "X-Api-Resource-Id": context.configuration.resourceId || (context.configuration.capability === "stt" ? "volc.bigasr.auc_turbo" : "seed-tts-2.0"), "X-Api-Request-Id": randomUUID(), "X-Api-Sequence": "-1" };
}
function streamedSpeech(input: string, voice: string, context: MediaPlatformContext): MediaAsset {
  return { name: "speech.mp3", contentType: "audio/mpeg", source: { type: "stream", open: async signal => {
    const result = await response(endpoint(context) + "/api/v3/tts/unidirectional", { ...context, signal }, { req_params: { text: input, speaker: voice, model: context.configuration.model, audio_params: { format: "mp3", sample_rate: 24000, speech_rate: Math.round(((context.configuration.speechRate ?? 1) - 1) * 100), loudness_rate: (context.configuration.volume ?? 100) - 100 } } }, speechHeaders(context));
    if (!result.body) throw new MediaError("MEDIA_INVALID_PLATFORM_RESPONSE");
    const lines = result.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let ended = false;
    let received = false;
    let completed = false;
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          while (true) {
            const newline = buffer.indexOf("\n");
            if (newline >= 0 || ended && buffer.trim()) {
              const line = (newline >= 0 ? buffer.slice(0, newline) : buffer).trim();
              buffer = newline >= 0 ? buffer.slice(newline + 1) : "";
              if (!line) continue;
              const part = object(JSON.parse(line));
              if (part.code !== 0 && part.code !== 20000000) throw new MediaError("MEDIA_PLATFORM_FAILED");
              if (part.code === 20000000) completed = true;
              if (typeof part.data === "string" && part.data) { received = true; controller.enqueue(Buffer.from(part.data, "base64")); return; }
              continue;
            }
            if (ended) { if (!received || !completed) throw new MediaError("MEDIA_INCOMPLETE_DOWNLOAD"); lines.releaseLock(); controller.close(); return; }
            const next = await lines.read(); ended = next.done; buffer += next.value ?? "";
          }
        } catch (error) { await lines.cancel().catch(() => undefined); lines.releaseLock(); controller.error(error); }
      },
      async cancel() { await lines.cancel(); lines.releaseLock(); },
    });
  } } };
}
export const volcengine: MediaPlatform = {
  id: "volcengine", packageName: "@haiqiai/media-platforms", version: "1.0.0", capabilities: ["stt", "tts", "image", "video"],
  async submit(input, context) {
    const model = context.configuration.model;
    const base = endpoint(context);
    if (input.capability === "image") {
      const image = await Promise.all(input.inputFiles.map(file => dataUrl(file, 10 * 1024 * 1024)));
      return { state: "complete", assets: images(await request(base + "/images/generations", context, { model, prompt: input.prompt, response_format: "url", ...(image.length ? { image } : {}) })) };
    }
    if (input.capability === "video") {
      const image = await Promise.all(input.inputFiles.map(async file => ({ type: "image_url", image_url: { url: await dataUrl(file, 10 * 1024 * 1024) }, role: "reference_image" })));
      const result = await request(base + "/contents/generations/tasks", context, { model, content: [{ type: "text", text: input.prompt }, ...image] });
      return { state: "pending", externalId: string(result.id), phase: "queued" };
    }
    if (input.capability === "stt") {
      const file = input.inputFiles[0];
      if (input.inputFiles.length !== 1 || !file || !["audio/wav", "audio/mpeg", "audio/ogg"].includes(file.contentType)) throw new MediaError("MEDIA_INPUT_UNSUPPORTED");
      const encoded = await dataUrl(file, 100 * 1024 * 1024);
      const result = await request(base + "/api/v3/auc/bigmodel/recognize/flash", context, { user: { uid: "haiqiai" }, audio: { data: encoded.slice(encoded.indexOf(",") + 1) }, request: { model_name: "bigmodel" } }, speechHeaders(context));
      const value = Array.isArray(result.result) ? object(result.result[0]) : object(result.result);
      return { state: "complete", assets: [{ name: "transcript.txt", contentType: "text/plain", source: { type: "text", text: string(value.text) } }] };
    }
    if (input.capability === "tts") {
      const voice = input.voiceId || context.configuration.voiceId;
      if (!voice) throw new MediaError("MEDIA_VOICE_REQUIRED");
      return { state: "complete", assets: [streamedSpeech(input.prompt, voice, context)] };
    }
    throw new MediaError("MEDIA_CAPABILITY_UNSUPPORTED");
  },
  async queryVoice(id, context) {
    const result = await request(endpoint(context) + "/api/v3/tts/get_voice", context, { speaker_id: id }, { "Content-Type": "application/json", "X-Api-Key": context.secret, "X-Api-Request-Id": randomUUID() });
    return { id: string(result.speaker_id), name: id, model: context.configuration.model, state: [2, 4].includes(Number(result.status)) ? "ready" : result.status === 1 ? "training" : "failed" };
  },
  async cloneVoice(sample, context) {
    const voiceId = sample.voiceId;
    if (!voiceId || !voiceId.startsWith("S_")) throw new MediaError("MEDIA_CLONE_SLOT_REQUIRED");
    const formats: Record<string, string> = { "audio/wav": "wav", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/aac": "aac" };
    const format = formats[sample.contentType];
    if (!format) throw new MediaError("MEDIA_INPUT_UNSUPPORTED");
    const encoded = await dataUrl(sample, 10 * 1024 * 1024);
    const result = await request(endpoint(context) + "/api/v3/tts/voice_clone", context, { speaker_id: voiceId, audio: { data: encoded.slice(encoded.indexOf(",") + 1), format } }, { "Content-Type": "application/json", "X-Api-Key": context.secret, "X-Api-Request-Id": randomUUID() });
    return { id: string(result.speaker_id), name: sample.name, model: context.configuration.model, state: [2, 4].includes(Number(result.status)) ? "ready" : result.status === 1 ? "training" : "failed" };
  },
  async query(id, context) {
    const result = await request(endpoint(context) + "/contents/generations/tasks/" + encodeURIComponent(id), context);
    if (result.status === "succeeded") return { state: "complete", externalId: id, assets: [urlAsset(object(result.content).video_url, "video.mp4", "video/mp4")] };
    if (["failed", "cancelled", "expired"].includes(String(result.status))) return { state: "failed", externalId: id, code: "MEDIA_PLATFORM_FAILED" };
    if (!["queued", "running"].includes(String(result.status))) throw new MediaError("MEDIA_INVALID_PLATFORM_RESPONSE");
    return { state: "pending", externalId: id, phase: result.status === "queued" ? "queued" : "running" };
  },
};
