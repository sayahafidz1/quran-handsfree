/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG_RECOGNITION?: string;
  /** Default (empty or "v1"): Tilawa 1.0. "v0" selects the old 0.4.0 Zipformer fallback. */
  readonly VITE_TILAWA_ENGINE?: string;
  /** Tilawa 1.0 model tier: "auto" (default), "full" or "lite". */
  readonly VITE_TILAWA_V1_TIER?: string;
  /** Tilawa 1.0 files: "remote" (default, downloaded from tilawa.dev/jsDelivr) or "local" (served by this app, see `npm run setup:v1`). */
  readonly VITE_TILAWA_V1_ASSETS?: string;
  /** Tilawa 1.0 ONNX providers, comma separated, e.g. "wasm" or "webgpu,wasm". Default: Tilawa's own. */
  readonly VITE_TILAWA_V1_PROVIDERS?: string;
}
