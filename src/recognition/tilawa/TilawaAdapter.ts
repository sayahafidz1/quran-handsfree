import RecognitionWorker from "../../workers/recognition.worker?worker";
import type { RecognitionAdapter, RecognitionEvent } from "../types";
import type { TilawaWorkerCommand } from "./types";

/**
 * TilawaAdapter acts as the isolation boundary / adapter between
 * the application's recognition contracts and the @tilawa/core worker runner.
 *
 * NOTE: Product-level logic (e.g. discovery -> lock -> verify -> next ayah)
 * must NEVER be placed here.
 */
export class TilawaAdapter implements RecognitionAdapter {
  private readonly worker: Worker;

  constructor(private readonly onEvent: (event: RecognitionEvent) => void) {
    this.worker = new RecognitionWorker();
    this.worker.onmessage = ({ data }: MessageEvent<RecognitionEvent>) => {
      this.onEvent(data);
    };
    this.worker.onerror = (error: globalThis.ErrorEvent) => {
      this.onEvent({ type: "error", message: error.message || "Worker execution error" });
    };
  }

  initialize(): void {
    this.send({ type: "init" });
  }

  feed(samples: Float32Array): void {
    this.worker.postMessage({ type: "audio", samples } satisfies TilawaWorkerCommand, [samples.buffer]);
  }

  reset(): void {
    this.send({ type: "reset" });
  }

  dispose(): void {
    this.worker.terminate();
  }

  private send(command: Exclude<TilawaWorkerCommand, { type: "audio" }>): void {
    this.worker.postMessage(command);
  }
}
