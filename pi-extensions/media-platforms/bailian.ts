import { MediaError, type MediaPlatform, type MediaPlatformContext, type MediaOperationResult } from "./contracts.js";
import { dataUrl, images, object, request, string, urlAsset } from "./http.js";
import { qwenSpeech } from "./qwen-speech.js";
function base(context: MediaPlatformContext): string {
  if (context.configuration.baseUrl) return context.configuration.baseUrl;
  return context.configuration.region === "ap-southeast-1" ? "https://dashscope-intl.aliyuncs.com" : "https://dashscope.aliyuncs.com";
}
function videoResult(output: Record<string, unknown>): MediaOperationResult {
  const externalId = string(output.task_id);
  if (output.task_status === "SUCCEEDED") return { state: "complete", externalId, assets: [urlAsset(output.video_url, "video.mp4", "video/mp4")] };
  if (["FAILED", "CANCELED", "UNKNOWN"].includes(String(output.task_status))) return { state: "failed", externalId, code: "MEDIA_PLATFORM_FAILED" };
  if (!["PENDING", "RUNNING"].includes(String(output.task_status))) throw new MediaError("MEDIA_INVALID_PLATFORM_RESPONSE");
  return { state: "pending", externalId, phase: output.task_status === "PENDING" ? "queued" : "running" };
}
export const bailian: MediaPlatform = {
  id: "bailian", packageName: "@haiqiai/media-platforms", version: "1.0.0", capabilities: ["stt", "tts", "image", "video", "music"],
  async submit(input, context) {
    const model = context.configuration.model;
    const endpoint = base(context);
    if (input.capability === "image") {
      if (!model.startsWith("qwen-image-3.")) throw new MediaError("MEDIA_MODEL_UNSUPPORTED");
      const reference = await Promise.all(input.inputFiles.map(file => dataUrl(file, 20 * 1024 * 1024)));
      return { state: "complete", assets: images(await request(endpoint + "/compatible-mode/v1/images/generations", context, { model, prompt: input.prompt, ...(reference.length ? { image: reference } : {}) })) };
    }
    if (input.capability === "stt") {
      if (!model.startsWith("qwen3-asr") || input.inputFiles.length !== 1) throw new MediaError("MEDIA_INPUT_UNSUPPORTED");
      const data = await dataUrl(input.inputFiles[0]!, 7_500_000);
      const result = await request(endpoint + "/compatible-mode/v1/chat/completions", context, { model, messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data } }] }], stream: false, asr_options: { enable_itn: false } });
      if (!Array.isArray(result.choices)) throw new MediaError("MEDIA_INVALID_PLATFORM_RESPONSE");
      const text = string(object(object(result.choices[0]).message).content);
      return { state: "complete", assets: [{ name: "transcript.txt", contentType: "text/plain", source: { type: "text", text } }] };
    }
    if (input.capability === "tts") {
      const voice = input.voiceId || context.configuration.voiceId;
      if (!voice) throw new MediaError("MEDIA_VOICE_REQUIRED");
      if (!model.startsWith("qwen3-tts") && !model.startsWith("qwen-tts")) throw new MediaError("MEDIA_MODEL_UNSUPPORTED");
      if (model.includes("realtime")) return { state: "complete", assets: [qwenSpeech(endpoint, input.prompt, voice, context)] };
      const result = await request(endpoint + "/api/v1/services/aigc/multimodal-generation/generation", context, { model, input: { text: input.prompt, voice, language_type: "Auto" } });
      return { state: "complete", assets: [urlAsset(object(object(result.output).audio).url, "speech.wav", "audio/wav")] };
    }
    if (input.capability === "music") {
      if (!["fun-music-v1", "fun-music-preview"].includes(model)) throw new MediaError("MEDIA_MODEL_UNSUPPORTED");
      if (context.configuration.region && context.configuration.region !== "cn-beijing") throw new MediaError("MEDIA_REGION_UNSUPPORTED");
      const result = await request(endpoint + "/api/v1/services/audio/music/generation", context, { model, input: { ...(input.lyrics && !input.instrumental ? { lyrics: input.lyrics } : { prompt: input.prompt }), is_instrumental: input.instrumental ?? false, format: "mp3" } });
      const output = object(result.output);
      const assets = [urlAsset(object(output.audio).url, "music.mp3", "audio/mpeg")];
      const lyrics = output.extra_info && object(output.extra_info).lyrics;
      if (typeof lyrics === "string" && lyrics) assets.push({ name: "lyrics.txt", contentType: "text/plain", source: { type: "text", text: lyrics } });
      return { state: "complete", assets };
    }
    if (input.capability === "video") {
      if (!model.startsWith("wan3.0")) throw new MediaError("MEDIA_MODEL_UNSUPPORTED");
      const media = await Promise.all(input.inputFiles.map(async file => ({ type: "reference_image", url: await dataUrl(file, 20 * 1024 * 1024) })));
      const result = await request(endpoint + "/api/v1/services/aigc/video-generation/video-synthesis", context, { model, input: { prompt: input.prompt, ...(media.length ? { media } : {}) }, parameters: { resolution: "480P", ratio: "adaptive", duration: 5 } }, { Authorization: "Bearer " + context.secret, "Content-Type": "application/json", "X-DashScope-Async": "enable" });
      return videoResult(object(result.output));
    }
    throw new MediaError("MEDIA_CAPABILITY_UNSUPPORTED");
  },
  async query(id, context) { return videoResult(object((await request(base(context) + "/api/v1/tasks/" + encodeURIComponent(id), context)).output)); },
  async cloneVoice(sample, context) {
    if (!context.configuration.model.startsWith("qwen3-tts-vc-realtime")) throw new MediaError("MEDIA_CLONE_MODEL_REQUIRED");
    if (!["audio/wav", "audio/mpeg", "audio/mp4"].includes(sample.contentType)) throw new MediaError("MEDIA_INPUT_UNSUPPORTED");
    const result = await request(base(context) + "/api/v1/services/audio/tts/customization", context, { model: "qwen-voice-enrollment", input: { action: "create", target_model: context.configuration.model, preferred_name: "haiqiai", audio: { data: await dataUrl(sample, 10 * 1024 * 1024) } } });
    const output = object(result.output);
    return { id: string(output.voice), name: sample.name, model: context.configuration.model, state: "ready" };
  },
};
