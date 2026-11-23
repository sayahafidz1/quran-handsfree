export interface VerseMatchEvent {
  type: "verse_match";
  surah: number;
  ayah: number;
  verse_text: string;
  confidence: number;
  /** Set only when the engine heard a basmalah right before this ayah (Tilawa 1.0). */
  basmala?: boolean;
}

export interface WordProgressEvent {
  type: "word_progress";
  surah: number;
  ayah: number;
  /**
   * Zero-based position of the engine's alignment cursor inside the ayah. It is
   * not a count of finished words and does not imply the word at the cursor is done.
   */
  word_index: number;
  total_words: number;
  /**
   * Zero-based indices of words with an `ok` or `unsure` verdict, sorted
   * ascending. It is computed independently of `word_index` and may have gaps.
   */
  matched_indices: number[];
}

/**
 * The engine's checker suspects (or confirms, or withdraws) that a word of an ayah was not read.
 * `word_index` is zero-based. Only omitted words / skipped passages are reported (Tilawa 1.0 only).
 */
export interface WordOmissionEvent {
  type: "word_omission";
  surah: number;
  ayah: number;
  word_index: number;
  state: "suspected" | "confirmed" | "resolved";
}

/** Diagnostic text from the engine (checker verdicts, capabilities). Only goes to the reading log. */
export interface EngineNoteEvent {
  type: "engine_note";
  text: string;
}

export interface LoadingStatusEvent {
  type: "loading_status";
  message: string;
}

export interface ReadyEvent {
  type: "ready";
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export type RecognitionEvent =
  | LoadingStatusEvent
  | ReadyEvent
  | EngineNoteEvent
  | WordOmissionEvent
  | ErrorEvent
  | VerseMatchEvent
  | WordProgressEvent;

export interface RecognitionAdapter {
  initialize(): void;
  feed(samples: Float32Array): void;
  reset(): void;
  dispose(): void;
}
