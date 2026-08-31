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
  word_index: number;
  total_words: number;
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
