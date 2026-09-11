import type { SelectedVerse } from "../../command/types.ts";
import type { RecognitionEvent, VerseMatchEvent, WordProgressEvent } from "../../recognition/types.ts";
import { getNextVerse } from "../../quran/index.ts";
import type { WordProgress } from "./ReadingState.ts";

export type ReadingSessionState =
  | "idle"
  | "discovering"
  | "locked"
  | "tracking"
  | "expecting_next"
  | "mismatch"
  | "completed";

export interface ReadingSessionSnapshot {
  state: ReadingSessionState;
  currentVerse: SelectedVerse | null;
  expectedVerse: SelectedVerse | null;
  detectedVerse: SelectedVerse | null;
  expectedNextVerse: SelectedVerse | null;
  wordProgress: WordProgress | null;
}

export type ReadingSessionListener = (snapshot: ReadingSessionSnapshot) => void;

/**
 * Product-level reading flow. Recognition events are inputs only; Tilawa remains
 * responsible for producing those events.
 */
export class ReadingSession {
  private state: ReadingSessionState = "idle";
  private currentVerse: SelectedVerse | null = null;
  private expectedVerse: SelectedVerse | null = null;
  private detectedVerse: SelectedVerse | null = null;
  private expectedNextVerse: SelectedVerse | null = null;
  private wordProgress: WordProgress | null = null;
  private readonly listeners = new Set<ReadingSessionListener>();

  public getState(): ReadingSessionSnapshot {
    return {
      state: this.state,
      currentVerse: this.copyVerse(this.currentVerse),
      expectedVerse: this.copyVerse(this.expectedVerse),
      detectedVerse: this.copyVerse(this.detectedVerse),
      expectedNextVerse: this.copyVerse(this.expectedNextVerse),
      wordProgress: this.copyWordProgress(this.wordProgress)
    };
  }

  public start(expectedVerse?: SelectedVerse): void {
    this.currentVerse = null;
    this.expectedVerse = expectedVerse ? { ...expectedVerse } : this.expectedVerse;
    this.detectedVerse = null;
    this.expectedNextVerse = null;
    this.wordProgress = null;
    this.state = "discovering";
    this.notify();
  }

  public reset(): void {
    this.state = "idle";
    this.currentVerse = null;
    this.expectedVerse = null;
    this.detectedVerse = null;
    this.expectedNextVerse = null;
    this.wordProgress = null;
    this.notify();
  }

  public handleEvent(event: RecognitionEvent): boolean {
    if (event.type === "verse_match") {
      this.handleVerseMatch(event);
      return true;
    } else if (event.type === "word_progress") {
      return this.handleWordProgress(event);
    }
    return false;
  }

  public handleVerseMatch(event: VerseMatchEvent): void {
    const detected = { surah: event.surah, ayah: event.ayah };
    this.detectedVerse = detected;

    // Keep the expected-next target authoritative while recovering from a
    // mismatch. A repeated current verse must not reset or advance it.
    if (this.expectedNextVerse) {
      if (this.matches(detected, this.expectedNextVerse)) {
        this.currentVerse = detected;
        this.expectedVerse = detected;
        this.expectedNextVerse = null;
        this.wordProgress = null;
        this.state = "tracking";
      } else {
        this.state = "mismatch";
      }
      this.notify();
      return;
    }

    // A verse match can begin a session without a command-selected target.
    // Once discovered, the verse becomes the session's locked target.
    if (this.expectedVerse && !this.matches(detected, this.expectedVerse)) {
      this.state = "mismatch";
      this.notify();
      return;
    }

    this.currentVerse = detected;
    this.expectedVerse = detected;
    this.state = "locked";
    this.notify();
  }

  public handleWordProgress(event: WordProgressEvent): boolean {
    const progress = {
      surah: event.surah,
      ayah: event.ayah,
      wordIndex: event.word_index,
      totalWords: event.total_words
    };

    if (!this.currentVerse || !this.matches(progress, this.currentVerse)) {
      return false;
    }

    this.wordProgress = progress;
    if (progress.wordIndex >= progress.totalWords) {
      const nextVerse = getNextVerse(progress);
      if (nextVerse) {
        this.expectedNextVerse = nextVerse;
        this.expectedVerse = this.expectedNextVerse;
        this.state = "expecting_next";
      } else {
        this.state = "completed";
      }
    } else {
      this.state = "tracking";
    }
    this.notify();
    return true;
  }

  public subscribe(listener: ReadingSessionListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private matches(
    verse: Pick<SelectedVerse, "surah" | "ayah">,
    expected: Pick<SelectedVerse, "surah" | "ayah">
  ): boolean {
    return verse.surah === expected.surah && verse.ayah === expected.ayah;
  }

  private copyVerse(verse: SelectedVerse | null): SelectedVerse | null {
    return verse ? { ...verse } : null;
  }

  private copyWordProgress(progress: WordProgress | null): WordProgress | null {
    return progress ? { ...progress } : null;
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
