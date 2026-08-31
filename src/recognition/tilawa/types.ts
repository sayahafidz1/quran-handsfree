import type { RecognitionEvent } from "../types";

export type TilawaWorkerCommand =
  | { type: "init" }
  | { type: "audio"; samples: Float32Array }
  | { type: "reset" };

export type TilawaWorkerResponse = RecognitionEvent;
