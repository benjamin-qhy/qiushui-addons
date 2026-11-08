import { randomUUID } from "node:crypto";
import { MediaError, type MediaAsset, type MediaPlatformContext } from "./contracts.js";
import { object, string } from "./http.js";

/** Qwen realtime sends PCM, which the host wraps as WAV while saving. */
export function qwenSpeech(base: string, text: string, voice: string, context: MediaPlatformContext): MediaAsset {
  return { name: "speech.wav", contentType: "audio/wav", pcm: { sampleRate: 24000, channels: 1, bits: 16 }, source: { type: "stream", open: async signal => {
    const url = new URL(base + "/api-ws/v1/realtime");
    url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
    url.searchParams.set("model", context.configuration.model);
    let socket: WebSocket;
    let stop = () => {};
    return new ReadableStream<Uint8Array>({
      start(controller) {
        let ended = false;
        let configured = false;
        let audioReceived = false;
        let timer: ReturnType<typeof setTimeout>;
        const finish = (error?: Error) => {
          if (ended) return;
          ended = true; clearTimeout(timer); signal.removeEventListener("abort", abort);
          socket?.close();
          if (error) controller.error(error); else controller.close();
        };
        const abort = () => finish(new MediaError("MEDIA_STOPPED"));
        const resetTimer = () => { clearTimeout(timer); timer = setTimeout(() => finish(new MediaError("MEDIA_PLATFORM_TIMEOUT")), 60_000); };
        stop = () => { if (ended) return; ended = true; clearTimeout(timer); signal.removeEventListener("abort", abort); socket?.close(); };
        const send = (type: string, fields: Record<string, unknown> = {}) => socket.send(JSON.stringify({ event_id: randomUUID(), type, ...fields }));
        // Bun's WebSocket supports HTTP handshake headers; credentials never enter the URL.
        const RuntimeWebSocket = WebSocket as typeof WebSocket & { new (url: string | URL, options: Bun.WebSocketOptions): WebSocket };
        socket = new RuntimeWebSocket(url, { headers: { Authorization: "Bearer " + context.secret } });
        socket.onopen = () => send("session.update", { session: { voice, mode: "commit", response_format: "pcm", sample_rate: 24000, ...(context.configuration.model.startsWith("qwen3-") ? { speech_rate: context.configuration.speechRate ?? 1, volume: Math.round((context.configuration.volume ?? 100) / 2) } : {}) } });
        socket.onmessage = event => {
          try {
            resetTimer();
            const value = object(JSON.parse(String(event.data)));
            if (value.type === "error") { finish(new MediaError("MEDIA_PLATFORM_FAILED")); return; }
            if (value.type === "session.updated" && !configured) {
              configured = true; send("input_text_buffer.append", { text }); send("input_text_buffer.commit"); send("session.finish");
            }
            if (value.type === "response.audio.delta") { audioReceived = true; controller.enqueue(Buffer.from(string(value.delta), "base64")); }
            if (value.type === "session.finished") finish(audioReceived ? undefined : new MediaError("MEDIA_INVALID_PLATFORM_RESPONSE"));
          } catch { finish(new MediaError("MEDIA_INVALID_PLATFORM_RESPONSE")); }
        };
        socket.onerror = () => finish(new MediaError("MEDIA_PLATFORM_FAILED"));
        socket.onclose = () => { if (!ended) finish(new MediaError("MEDIA_INCOMPLETE_DOWNLOAD")); };
        signal.addEventListener("abort", abort, { once: true });
        resetTimer(); if (signal.aborted) abort();
      },
      cancel() { stop(); },
    });
  } } };
}
