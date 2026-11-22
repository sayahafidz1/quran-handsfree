/**
 * Which recognition engine to build: Tilawa 1.0 is the default (since 2026-11-23);
 * `VITE_TILAWA_ENGINE=v0` keeps the old 0.4.0 Zipformer path as a stable fallback. Pure, so it can be tested.
 */
export type EngineChoice = "v0" | "v1";

export function chooseEngine(value: string | undefined): EngineChoice {
  const normalized = value?.trim().toLowerCase();
  return normalized === "v0" || normalized === "0.4.0" ? "v0" : "v1";
}
