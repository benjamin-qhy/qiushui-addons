import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { MediaPlatform } from "../contracts.js";
import { volcengine } from "../volcengine.js";
export default function mediaPlatformExtension(pi: ExtensionAPI) {
  const unregister = pi.events.on("haiqiai:media:discover", receiver => {
    if (typeof receiver === "function") (receiver as (platform: MediaPlatform) => void)(volcengine);
  });
  pi.on("session_shutdown", async () => { unregister(); });
}
