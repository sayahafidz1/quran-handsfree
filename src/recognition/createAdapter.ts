import type { RecognitionAdapter, RecognitionEvent } from "./types";
import { TilawaAdapter } from "./tilawa/TilawaAdapter";
import { createTilawaV1Adapter } from "./tilawa/TilawaV1Adapter";

/** Chooses the engine at build/dev time: `VITE_TILAWA_ENGINE=v1` selects Tilawa 1.0, default is 0.4.0. */
export function createRecognitionAdapter(onEvent: (event: RecognitionEvent) => void): RecognitionAdapter {
  return import.meta.env.VITE_TILAWA_ENGINE === "v1" ? createTilawaV1Adapter(onEvent) : new TilawaAdapter(onEvent);
}
