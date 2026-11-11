import type { SelectedVerse } from "../../command/types.ts";
import type { RecognitionEvent, VerseMatchEvent, WordProgressEvent } from "../../recognition/types.ts";
import { getNextVerse, getPreviousVerse } from "../../quran/index.ts";
export interface WordProgress {
  surah: number;
  ayah: number;
  /** Zero-based alignment cursor inside the ayah (Tilawa `word_index`). */
  wordIndex: number;
  totalWords: number;
  /** Sorted, unique zero-based indices of words recognized as `ok` or `unsure`. */
  matchedIndices: number[];
}

/**
 * The reader has reached the end of an ayah once its last word has an
 * `ok`/`unsure` verdict. `wordIndex` is a cursor, so it can never be used for
 * this: Tilawa keeps it below `totalWords`.
 */
export function hasReachedVerseEnd(progress: Pick<WordProgress, "totalWords" | "matchedIndices">): boolean {
  return progress.totalWords > 0 && progress.matchedIndices.includes(progress.totalWords - 1);
}

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

  public stopListening(): void {
    if (this.state === "idle") return;
    this.state = "idle";
    this.notify();
  }

  public resumeListening(): void {
    if (this.state === "completed") return;
    if (!this.currentVerse && !this.expectedVerse) return;
    this.state = this.currentVerse ? "tracking" : "discovering";
    this.notify();
  }

  public returnToActivePosition(): void {
    if (!this.currentVerse) return;
    this.expectedVerse = { ...this.currentVerse };
    this.state = "tracking";
    this.notify();
  }

  public repeatActiveVerse(): void {
    const active = this.currentVerse ?? this.expectedVerse;
    if (!active) return;
    this.start(active);
  }

  public moveToNextVerse(): void {
    const active = this.currentVerse ?? this.expectedVerse;
    const next = active ? getNextVerse(active) : null;
    if (next) this.start(next);
  }

  public moveToPreviousVerse(): void {
    const active = this.currentVerse ?? this.expectedVerse;
    const previous = active ? getPreviousVerse(active) : null;
    if (previous) this.start(previous);
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
    if (this.state === "completed") return;

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

    // Repeated matches of the verse already being tracked must not demote
    // "tracking" back to "locked".
    const keepTracking = this.state === "tracking"
      && this.currentVerse !== null
      && this.matches(detected, this.currentVerse);
    this.currentVerse = detected;
    this.expectedVerse = detected;
    this.state = keepTracking ? "tracking" : "locked";
    this.notify();
  }

  public handleWordProgress(event: WordProgressEvent): boolean {
    if (this.state === "completed") return false;

    const progress: WordProgress = {
      surah: event.surah,
      ayah: event.ayah,
      wordIndex: event.word_index,
      totalWords: event.total_words,
      matchedIndices: this.normalizeMatchedIndices(event.matched_indices, event.total_words)
    };

    if (!this.currentVerse) return false;

    // Tilawa's cursor may enter the next ayah before the current one is
    // confirmed, so the cursor alone never advances the session. Only an ayah
    // that was completed (expectedNextVerse is set) may be followed; progress
    // for any other verse is ignored.
    if (!this.matches(progress, this.currentVerse)) {
      if (!this.expectedNextVerse || !this.matches(progress, this.expectedNextVerse)) return false;
      this.advanceTo(this.expectedNextVerse);
    }

    this.wordProgress = progress;
    if (hasReachedVerseEnd(progress)) {
      const nextVerse = getNextVerse(progress);
      if (nextVerse) {
        this.expectedNextVerse = nextVerse;
        this.expectedVerse = nextVerse;
        this.state = "expecting_next";
      } else {
        this.state = "completed";
      }
    } else {
      // Completion sticks: `matched_indices` is a snapshot of the latest
      // alignment, not a history, so the last word can drop out of it (verdict
      // revisions, a repeated passage). An already completed ayah keeps its
      // expectedNextVerse; only the live word progress goes back to tracking.
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

  private advanceTo(verse: Pick<SelectedVerse, "surah" | "ayah">): void {
    const next = { surah: verse.surah, ayah: verse.ayah };
    this.currentVerse = next;
    this.expectedVerse = { ...next };
    this.detectedVerse = { ...next };
    this.expectedNextVerse = null;
    this.wordProgress = null;
    this.state = "tracking";
  }

  private normalizeMatchedIndices(indices: readonly number[], totalWords: number): number[] {
    const valid = indices.filter((index) => Number.isInteger(index) && index >= 0 && index < totalWords);
    return [...new Set(valid)].sort((a, b) => a - b);
  }

  private copyVerse(verse: SelectedVerse | null): SelectedVerse | null {
    return verse ? { ...verse } : null;
  }

  private copyWordProgress(progress: WordProgress | null): WordProgress | null {
    return progress ? { ...progress, matchedIndices: [...progress.matchedIndices] } : null;
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
