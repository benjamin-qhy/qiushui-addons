import { MediaError, type MediaPlatform } from "./contracts.js";
import { images, request } from "./http.js";
export const cliproxyapi: MediaPlatform = {
  id: "cliproxyapi", packageName: "@haiqiai/media-platforms", version: "1.0.0", capabilities: ["image"],
  async submit(input, context) {
    if (input.capability !== "image") throw new MediaError("MEDIA_CAPABILITY_UNSUPPORTED");
    const base = context.configuration.baseUrl;
    if (!base) throw new MediaError("MEDIA_INVALID_CONFIGURATION");
    if (input.inputFiles.length) {
      const body = new FormData(); body.set("model", context.configuration.model); body.set("prompt", input.prompt);
      for (const [index, file] of input.inputFiles.entries()) {
        const extension = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[file.contentType];
        if (!extension) throw new MediaError("MEDIA_INPUT_UNSUPPORTED");
        body.append("image[]", Bun.file(file.path, { type: file.contentType }), `reference-${index + 1}.${extension}`);
      }
      return { state: "complete", assets: images(await request(base + "/images/edits", context, body)) };
    }
    return { state: "complete", assets: images(await request(base + "/images/generations", context, { model: context.configuration.model, prompt: input.prompt })) };
  },
};
