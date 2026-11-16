/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG_RECOGNITION?: string;
  /** "v1" runs the Tilawa 1.0 evaluation path; anything else keeps 0.4.0 Zipformer. */
  readonly VITE_TILAWA_ENGINE?: string;
  /** Tilawa 1.0 model tier: "auto" (default), "full" or "lite". */
  readonly VITE_TILAWA_V1_TIER?: string;
  /** Tilawa 1.0 ONNX providers, comma separated, e.g. "wasm" or "webgpu,wasm". Default: Tilawa's own. */
  readonly VITE_TILAWA_V1_PROVIDERS?: string;
}
