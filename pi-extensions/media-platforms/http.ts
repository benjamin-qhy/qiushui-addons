import { MediaError, type MediaAsset, type MediaPlatformContext } from "./contracts.js";
export type JsonObject = Record<string, unknown>;
export function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MediaError("MEDIA_INVALID_PLATFORM_RESPONSE");
  return value as JsonObject;
}
export function string(value: unknown): string {
  if (typeof value !== "string" || !value) throw new MediaError("MEDIA_INVALID_PLATFORM_RESPONSE");
  return value;
}
export async function response(url: string, context: MediaPlatformContext, body?: unknown, headers?: Record<string, string>): Promise<Response> {
  const result = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: headers ?? { Authorization: "Bearer " + context.secret, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: context.signal, redirect: "error" });
  if (!result.ok) {
    const raw = await result.text();
    const body = context.secret ? raw.split(context.secret).join("[REDACTED]") : raw;
    throw new MediaError(result.status === 401 ? "MEDIA_AUTH_FAILED" : result.status === 403 ? "MEDIA_NOT_ENABLED" : result.status === 429 ? "MEDIA_RATE_LIMITED" : "MEDIA_PLATFORM_FAILED", { status: result.status, body });
  }
  return result;
}
export async function request(url: string, context: MediaPlatformContext, body?: unknown, headers?: Record<string, string>): Promise<JsonObject> {
  const reply = await response(url, context, body, headers);
  const raw = await reply.text();
  const result = object(JSON.parse(raw));
  if (result.error || (result.code !== undefined && ![0, "", 20000000, "20000000", "Success"].includes(result.code as string | number))) throw new MediaError("MEDIA_PLATFORM_FAILED", { status: reply.status, body: context.secret ? raw.split(context.secret).join("[REDACTED]") : raw });
  return result;
}
export function binaryAsset(encoded: string, name: string, contentType: string): MediaAsset {
  const data = encoded.replace(/[\r\n]/g, "");
  if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new MediaError("MEDIA_INVALID_PLATFORM_RESPONSE");
  return { name, contentType, source: { type: "stream", open: async signal => {
    let offset = 0;
    return new ReadableStream({ pull(controller) {
      signal.throwIfAborted();
      if (offset === data.length) { controller.close(); return; }
      const end = Math.min(data.length, offset + 64 * 1024);
      controller.enqueue(Buffer.from(data.slice(offset, end), "base64")); offset = end;
    } });
  } } };
}
export function urlAsset(value: unknown, name: string, contentType: string): MediaAsset {
  const url = string(value);
  const data = /^data:([^;,]+);base64,(.+)$/s.exec(url);
  if (data) return binaryAsset(data[2]!, name, data[1]!);
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new MediaError("MEDIA_INVALID_PLATFORM_RESPONSE");
  return { name, contentType, source: { type: "url", url } };
}
export async function dataUrl(file: { path: string; contentType: string }, maximum: number): Promise<string> {
  const source = Bun.file(file.path);
  if (source.size > maximum) throw new MediaError("MEDIA_INPUT_TOO_LARGE");
  return `data:${file.contentType};base64,${Buffer.from(await source.arrayBuffer()).toString("base64")}`;
}
export function images(result: JsonObject): MediaAsset[] {
  if (!Array.isArray(result.data) || !result.data.length) throw new MediaError("MEDIA_INVALID_PLATFORM_RESPONSE");
  return result.data.map((raw, index) => {
    const item = object(raw);
    if (item.b64_json) {
      const encoded = string(item.b64_json);
      const magic = Buffer.from(encoded.slice(0, 32), "base64");
      const type = magic[0] === 0xff ? "jpeg" : magic.toString("ascii", 8, 12) === "WEBP" ? "webp" : "png";
      return binaryAsset(encoded, `image-${index + 1}.${type}`, `image/${type}`);
    }
    const url = string(item.url);
    const dataType = /^data:image\/(png|jpeg|webp);base64,/.exec(url)?.[1];
    const type = dataType ?? /\.(jpeg|jpg|webp)(?:\?|$)/i.exec(url)?.[1]?.toLowerCase().replace("jpg", "jpeg") ?? "png";
    return urlAsset(url, `image-${index + 1}.${type}`, `image/${type}`);
  });
}
