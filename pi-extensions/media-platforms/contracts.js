/** Public runtime values for the media platform extension contract. */
export const MEDIA_CAPABILITIES = ["stt", "tts", "image", "video", "music"];
export class MediaError extends Error {
  constructor(code, platformError) { super(code); this.code = code; this.platformError = platformError; this.name = "MediaError"; }
}
export function isMediaCapability(value) {
  return typeof value === "string" && MEDIA_CAPABILITIES.includes(value);
}
export function assertMediaIdentity(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._-]{0,95}$/.test(value)) {
    throw new MediaError("MEDIA_INVALID_IDENTITY");
  }
}
