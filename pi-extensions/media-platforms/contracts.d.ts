/** Platform implementations are supplied by Pi packages; this is their host contract. */
export declare const MEDIA_CAPABILITIES: readonly ["stt", "tts", "image", "video", "music"];
export type MediaCapability = typeof MEDIA_CAPABILITIES[number];

export interface MediaConfiguration {
  id: string;
  capability: MediaCapability;
  platform: string;
  model: string;
  baseUrl: string;
  region: string;
  appId: string;
  resourceId: string;
  enabled?: boolean;
  speechRate?: number;
  volume?: number;
  voiceId: string;
  credentialRef: string;
  revision: number;
  updatedAt: string;
}

/** Binary media never belongs in tool content or the Pi session transcript. */
export type MediaAssetSource =
  | { type: "url"; url: string }
  | { type: "stream"; open: (signal: AbortSignal) => Promise<ReadableStream<Uint8Array>> }
  | { type: "text"; text: string };

export interface MediaAsset {
  name: string;
  contentType: string;
  pcm?: { sampleRate: number; channels: number; bits: 16 };
  source: MediaAssetSource;
}

export interface MediaRequest {
  capability: MediaCapability;
  prompt: string;
  inputFiles: readonly { path: string; contentType: string }[];
  voiceId?: string;
  lyrics?: string;
  instrumental?: boolean;
}

export type MediaOperationResult =
  | { state: "pending"; externalId: string; phase: "queued" | "running" }
  | { state: "complete"; externalId?: string; assets: readonly MediaAsset[] }
  | { state: "failed"; externalId?: string; code: string };

export interface MediaPlatformContext {
  configuration: Readonly<MediaConfiguration>;
  /** Scoped to one configuration and call; never mutate process.env. */
  secret: string;
  signal: AbortSignal;
}

export interface MediaPlatform {
  id: string;
  packageName: string;
  version: string;
  capabilities: readonly MediaCapability[];
  submit(request: MediaRequest, context: MediaPlatformContext): Promise<MediaOperationResult>;
  query?(externalId: string, context: MediaPlatformContext): Promise<MediaOperationResult>;
  cloneVoice?(sample: { path: string; contentType: string; name: string; voiceId?: string }, context: MediaPlatformContext): Promise<MediaVoice>;
  queryVoice?(id: string, context: MediaPlatformContext): Promise<MediaVoice>;
  cancel?(externalId: string, context: MediaPlatformContext): Promise<{ confirmed: boolean }>;
}

export declare class MediaError extends Error {
  readonly code: string;
  readonly platformError?: { status: number; body: string };
  constructor(code: string, platformError?: { status: number; body: string });
}
export declare function isMediaCapability(value: unknown): value is MediaCapability;
export declare function assertMediaIdentity(value: unknown): asserts value is string;

export interface MediaVoice {
  id: string;
  name: string;
  model: string;
  state: "ready" | "training" | "failed";
}
