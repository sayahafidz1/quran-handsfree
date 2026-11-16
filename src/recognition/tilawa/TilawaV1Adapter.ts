import RecognitionV1Worker from "../../workers/recognition.v1.worker?worker";
import type { RecognitionEvent } from "../types";
import { TilawaAdapter } from "./TilawaAdapter";

/**
 * Evaluation path for Tilawa 1.0 (branch eval/tilawa-1.0). Same adapter
 * contract and worker protocol as the 0.4.0 path; only the worker differs.
 */
export function createTilawaV1Adapter(onEvent: (event: RecognitionEvent) => void): TilawaAdapter {
  return new TilawaAdapter(onEvent, () => new RecognitionV1Worker());
}
