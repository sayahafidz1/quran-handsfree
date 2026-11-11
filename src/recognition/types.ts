export interface VerseMatchEvent {
  type: "verse_match";
  surah: number;
  ayah: number;
  verse_text: string;
  confidence: number;
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
  | ErrorEvent
  | VerseMatchEvent
  | WordProgressEvent;

export interface RecognitionAdapter {
  initialize(): void;
  feed(samples: Float32Array): void;
  reset(): void;
  dispose(): void;
}
