import type { WordProgress } from "../app/reading/ReadingSession.ts";
import type { QuranWord } from "../quran/content/types.ts";

export type QuranWordHighlight = "passed" | "current" | "upcoming";

/**
 * Recognition reports one-based word positions while QuranWord.index is zero-based.
 */
export function getWordHighlight(word: QuranWord, progress: WordProgress | null): QuranWordHighlight {
  if (!progress) return "upcoming";
  if (progress.wordIndex >= progress.totalWords || word.index < progress.wordIndex - 1) return "passed";
  return word.index === progress.wordIndex - 1 ? "current" : "upcoming";
}
