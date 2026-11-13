import type { RecognitionEvent } from "../types";

/**
 * Pure translation of Tilawa 1.0 `position` events into the application's
 * recognition contract (`verse_match` / `word_progress`).
 *
 * The types below are structural copies of the fields we read, so this file
 * does not import @tilawa/core and can be unit-tested without the package.
 * NOTE: product rules (lock, strict next ayah, mismatch) stay in ReadingSession.
 */
export interface V1WordRef {
  surah: number;
  ayah: number;
  /** 1-based index of the word inside the ayah. */
  word: number;
}

export interface V1PositionEvent {
  type: "position";
  state: "acquiring" | "locked" | "ambiguous" | "lost";
  observed: {
    word: V1WordRef;
    span: { start: V1WordRef; end: V1WordRef };
    confidence: number;
    prefix?: "basmala";
  }[];
}

export type V1Event = V1PositionEvent | { type: string };

/** Returns the words of an ayah (Uthmani), or undefined when unknown. */
export type AyahWordsLookup = (surah: number, ayah: number) => readonly string[] | undefined;

export class V1PositionMapper {
  private currentAyah: string | null = null;
  private lastProgressKey: string | null = null;

  private readonly words: AyahWordsLookup;

  constructor(words: AyahWordsLookup) {
    this.words = words;
  }

  /** Forget everything; used when a new Tilawa session starts. */
  reset(): void {
    this.currentAyah = null;
    this.lastProgressKey = null;
  }

  map(event: V1Event): RecognitionEvent[] {
    // Only `locked` positions move the app; ambiguous/lost/acquiring are ignored.
    if (event.type !== "position") return [];
    const position = event as V1PositionEvent;
    if (position.state !== "locked") return [];
    const top = position.observed[0];
    if (!top) return [];

    const { surah, ayah } = top.word;
    const ayahWords = this.words(surah, ayah);
    if (!ayahWords || ayahWords.length === 0) return [];

    const total = ayahWords.length;
    const cursor = clamp(top.word.word - 1, 0, total - 1);
    const out: RecognitionEvent[] = [];

    const ayahKey = `${surah}:${ayah}`;
    if (ayahKey !== this.currentAyah) {
      this.currentAyah = ayahKey;
      this.lastProgressKey = null;
      out.push({
        type: "verse_match",
        surah,
        ayah,
        verse_text: ayahWords.join(" "),
        confidence: top.confidence
      });
    }

    // Words of this ayah covered by the evidence: from where the span starts
    // (or the ayah's first word when the span began in an earlier ayah) up to
    // the most recently recited word.
    const { start } = top.span;
    const firstCovered = start.surah === surah && start.ayah === ayah ? clamp(start.word - 1, 0, cursor) : 0;
    const matched: number[] = [];
    for (let i = firstCovered; i <= cursor; i++) matched.push(i);

    const progressKey = `${cursor}|${firstCovered}`;
    if (progressKey !== this.lastProgressKey) {
      this.lastProgressKey = progressKey;
      out.push({
        type: "word_progress",
        surah,
        ayah,
        word_index: cursor,
        total_words: total,
        matched_indices: matched
      });
    }
    return out;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
