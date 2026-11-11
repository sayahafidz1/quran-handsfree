import { hasReachedVerseEnd, type WordProgress } from "../app/reading/ReadingSession.ts";
import type { QuranWord } from "../quran/content/types.ts";

export type QuranWordHighlight = "passed" | "current" | "upcoming";

/**
 * `progress.wordIndex` is the zero-based alignment cursor reported by Tilawa and
 * `QuranWord.index` is zero-based as well, so they compare directly. Words with an
 * `ok`/`unsure` verdict (`matchedIndices`) and words before the cursor are passed.
 * Once the last word has a verdict, the whole ayah is passed.
 */
export function getWordHighlight(word: QuranWord, progress: WordProgress | null): QuranWordHighlight {
  if (!progress) return "upcoming";
  if (hasReachedVerseEnd(progress)) return "passed";
  if (word.index === progress.wordIndex) return "current";
  if (word.index < progress.wordIndex || progress.matchedIndices.includes(word.index)) return "passed";
  return "upcoming";
}
