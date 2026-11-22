import type { RecognitionAdapter, RecognitionEvent } from "./types";
import { TilawaAdapter } from "./tilawa/TilawaAdapter";
import { createTilawaV1Adapter } from "./tilawa/TilawaV1Adapter";
import { chooseEngine } from "./engineChoice";

/** Chooses the engine at build/dev time: Tilawa 1.0 by default; `VITE_TILAWA_ENGINE=v0` selects the 0.4.0 fallback. */
export function createRecognitionAdapter(onEvent: (event: RecognitionEvent) => void): RecognitionAdapter {
  return chooseEngine(import.meta.env.VITE_TILAWA_ENGINE) === "v0"
    ? new TilawaAdapter(onEvent)
    : createTilawaV1Adapter(onEvent);
}
