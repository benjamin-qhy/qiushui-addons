import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { MediaPlatform } from "../contracts.js";
import { bailian } from "../bailian.js";
export default function mediaPlatformExtension(pi: ExtensionAPI) {
  const unregister = pi.events.on("haiqiai:media:discover", receiver => {
    if (typeof receiver === "function") (receiver as (platform: MediaPlatform) => void)(bailian);
  });
  pi.on("session_shutdown", async () => { unregister(); });
}
