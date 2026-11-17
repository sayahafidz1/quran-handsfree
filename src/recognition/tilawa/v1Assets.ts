/**
 * Pure helpers for where the Tilawa 1.0 files come from. No browser or package
 * imports, so they can be unit-tested with plain Node.
 *
 * - "remote" (default): the SDK downloads the model from tilawa.dev and the
 *   onnxruntime-web files from jsDelivr (needs internet).
 * - "local": everything is read from this app's own origin (`/tilawa-v1/`,
 *   filled by `npm run setup:v1`), with no request to another site.
 */
export type V1AssetMode = "local" | "remote";
export type V1Tier = "auto" | "full" | "lite";
export type V1Provider = "webgpu" | "wasm";

export function parseAssetMode(value: string | undefined): V1AssetMode {
  return value === "local" ? "local" : "remote";
}

/** Local mode only ships the tier that `setup:v1` downloaded, so it never lets the SDK pick ("auto"). */
export function resolveTier(mode: V1AssetMode, value: string | undefined): V1Tier {
  if (value === "full" || value === "lite") return value;
  return mode === "local" ? "full" : "auto";
}

/**
 * Tier to retry with when loading the model failed (for example, not enough memory on a weak phone for the
 * 68 MB "full" model). Only remote mode has a fallback: local mode ships just the tier `setup:v1` downloaded.
 * Returns null when there is nothing lighter to try.
 */
export function fallbackTier(mode: V1AssetMode, tier: V1Tier): V1Tier | null {
  if (mode !== "remote") return null;
  return tier === "lite" ? null : "lite";
}

export function parseProviders(value: string | undefined): V1Provider[] | undefined {
  if (!value) return undefined;
  const list = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is V1Provider => item === "webgpu" || item === "wasm");
  return list.length > 0 ? list : undefined;
}

/** Absolute URL prefix (with trailing slash) of the self-hosted tree, e.g. `https://app.example/tilawa-v1/`. */
export function localAssetBase(origin: string, baseUrl: string): string {
  const withLeading = baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`;
  const withTrailing = withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
  return `${origin}${withTrailing}tilawa-v1/`;
}

/** Same shape as the SDK's `ModelStorage`. */
export interface BytesStorage {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, bytes: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * Keeps downloaded model bytes only in memory, so nothing is written to the
 * browser's Cache API and an incognito window behaves like a normal one.
 */
export function createMemoryStorage(): BytesStorage {
  const store = new Map<string, Uint8Array>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, bytes) {
      store.set(key, bytes);
    },
    async delete(key) {
      store.delete(key);
    },
    async keys() {
      return [...store.keys()];
    }
  };
}
