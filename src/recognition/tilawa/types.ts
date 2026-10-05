import type { WorkerOutbound } from "@tilawa/core";
import type { RecognitionEvent, VerseMatchEvent, WordProgressEvent } from "../types";

export type TilawaWorkerCommand =
  | { type: "init" }
  | { type: "audio"; samples: Float32Array }
  | { type: "reset" };

export type TilawaWorkerResponse = RecognitionEvent;

export function toRecognitionEvent(
  message: WorkerOutbound
): VerseMatchEvent | WordProgressEvent | null {
  switch (message.type) {
    case "verse_match":
      return {
        type: "verse_match",
        surah: message.surah,
        ayah: message.ayah,
        verse_text: message.verse_text,
        confidence: message.confidence
      };
    case "word_progress":
      return {
        type: "word_progress",
        surah: message.surah,
        ayah: message.ayah,
        word_index: message.word_index,
        total_words: message.total_words
      };
    default:
      return null;
  }
}
