import { hasReachedVerseEnd, type WordProgress } from "../app/reading/ReadingSession.ts";
import type { QuranWord } from "../quran/content/types.ts";

export type QuranWordHighlight = "passed" | "current" | "upcoming" | "skipped" | "next";

/**
 * `progress.wordIndex` is the zero-based alignment cursor reported by Tilawa and
 * `QuranWord.index` is zero-based as well, so they compare directly. Words with an
 * `ok`/`unsure` verdict (`matchedIndices`) and words before the cursor are passed.
 * Once the last word has a verdict, the whole ayah is passed. Words in `skipped` (never recognized
 * although the reader went past them) are always "skipped".
 */
export function getWordHighlight(
  word: QuranWord,
  progress: WordProgress | null,
  skipped: readonly number[] = [],
  awaitingStart = false
): QuranWordHighlight {
  // A skipped word stays marked, also while the reader is further on or the ayah is finished.
  if (skipped.includes(word.index)) return "skipped";
  // Before the engine reports any word of this ayah, the first word is shown as the place to start.
  if (!progress) return awaitingStart && word.index === 0 ? "next" : "upcoming";
  if (hasReachedVerseEnd(progress)) return "passed";
  if (word.index === progress.wordIndex) return "current";
  if (word.index < progress.wordIndex || progress.matchedIndices.includes(word.index)) return "passed";
  return "upcoming";
}
