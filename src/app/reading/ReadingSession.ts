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
  /**
   * True while a brand-new search is allowed: after a surah is finished and
   * after a long pause. The next `verse_match` then locks wherever the reader
   * is, instead of having to equal `expectedNextVerse`.
   */
  private discoveryOpen = false;
  /**
   * True while the current lock came from discovery and its ayah is not yet
   * finished. Parallel ayahs share their opening words (3:142 vs 2:214), so the
   * engine may correct its first guess; until the ayah is finished a correction
   * to an ayah of another surah re-locks instead of being a mismatch. Jumps
   * inside the same surah and manual targets stay strict.
   */
  private provisional = false;
  private readonly listeners = new Set<ReadingSessionListener>();
  private readonly restartListeners = new Set<() => void>();

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
    this.discoveryOpen = false;
    this.provisional = false;
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
    this.discoveryOpen = false;
    this.provisional = false;
    this.notify();
  }

  /**
   * The reader has been silent or off-track for a long time (rest between
   * ruku', sujud, rak'ahs...). Allow the next detection to be a new place and
   * ask the engine to search again. Position shown in the UI is kept. Does
   * nothing before a first lock, so a manually chosen target stays strict.
   */
  public handlePause(): void {
    if (this.state === "idle" || this.state === "completed") return;
    if (!this.currentVerse || this.discoveryOpen) return;
    this.discoveryOpen = true;
    this.requestDiscoveryRestart();
  }

  /**
   * An explicit stop. The reader may continue somewhere else when listening starts again (rest between
   * rak'ahs, another place), so the next detection after the restart is a new search: it locks wherever
   * the reader is, even when a target was chosen by hand. The position shown in the UI is kept.
   * Opening a verse and then starting to listen (no stop in between) stays strict.
   */
  public stopListening(): void {
    if (this.state === "idle") return;
    this.state = "idle";
    this.discoveryOpen = true;
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
    this.provisional = false;
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

    // The basmalah recited before the next surah is detected as Al-Fatihah 1:1.
    // That is not a mismatch, but the engine may now be locked onto Al-Fatihah
    // (stayOnSurah), so restart discovery to let it find the surah that follows.
    if (this.isBasmalahBeforeNextSurah(detected)) {
      this.requestDiscoveryRestart();
      return;
    }

    // A new search is allowed after a surah end or a long pause, and when a
    // basmalah was heard before ayah 1. The first detection then locks there.
    if (this.discoveryOpen || (event.basmala === true && event.ayah === 1)) {
      this.discoveryOpen = false;
      const followsExpected = this.expectedNextVerse !== null && this.matches(detected, this.expectedNextVerse);
      if (!followsExpected) {
        this.expectedNextVerse = null;
        this.expectedVerse = null;
        if (!this.currentVerse || !this.matches(detected, this.currentVerse)) this.wordProgress = null;
      }
    }

    this.detectedVerse = detected;

    // Keep the expected-next target authoritative while recovering from a
    // mismatch. A repeated current verse must not reset or advance it.
    if (this.expectedNextVerse) {
      if (this.matches(detected, this.expectedNextVerse)) {
        this.currentVerse = detected;
        this.expectedVerse = detected;
        this.expectedNextVerse = null;
        this.wordProgress = null;
        this.provisional = false;
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
      if (this.provisional && detected.surah !== this.expectedVerse.surah) {
        // The engine corrected its first guess to a parallel ayah of another
        // surah: re-lock. Jumps inside the same surah stay strict.
        this.currentVerse = detected;
        this.expectedVerse = { ...detected };
        this.wordProgress = null;
        this.state = "locked";
      } else {
        this.state = "mismatch";
      }
      this.notify();
      return;
    }

    // A lock that did not come from a manual target or a previous lock is a
    // discovery guess and stays provisional until its ayah is finished.
    if (this.expectedVerse === null) this.provisional = true;

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
    let restartDiscovery = false;
    if (hasReachedVerseEnd(progress)) {
      this.provisional = false;
      const nextVerse = getNextVerse(progress);
      if (nextVerse) {
        // Finishing the last ayah of a surah: the engine stays on that surah
        // (stayOnSurah), so ask for a fresh discovery, once per surah end.
        const alreadyExpected = this.expectedNextVerse !== null
          && this.matches(this.expectedNextVerse, nextVerse);
        restartDiscovery = nextVerse.surah !== progress.surah && !alreadyExpected;
        if (restartDiscovery) this.discoveryOpen = true;
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
    if (restartDiscovery) this.requestDiscoveryRestart();
    return true;
  }

  public subscribe(listener: ReadingSessionListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  /**
   * The session never talks to the engine itself. It asks, through this
   * listener, for the recognition engine to restart its discovery.
   */
  public onDiscoveryRestart(listener: () => void): () => void {
    this.restartListeners.add(listener);
    return () => this.restartListeners.delete(listener);
  }

  private requestDiscoveryRestart(): void {
    for (const listener of this.restartListeners) listener();
  }

  private isBasmalahBeforeNextSurah(detected: Pick<SelectedVerse, "surah" | "ayah">): boolean {
    const next = this.expectedNextVerse;
    return next !== null
      && next.ayah === 1
      && next.surah !== 1
      && detected.surah === 1
      && detected.ayah === 1;
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
    this.provisional = false;
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
