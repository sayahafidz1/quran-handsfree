import { getSurahInfo } from "./validator.ts";

export interface QuranVerseReference {
  surah: number;
  ayah: number;
}

/**
 * Returns the verse immediately after the given reference.
 *
 * A null result means the reference is the final verse of the Quran (or is
 * not a valid Quran reference).
 */
export function getNextVerse(current: QuranVerseReference): QuranVerseReference | null {
  const surahInfo = getSurahInfo(current.surah);
  if (!surahInfo || current.ayah < 1 || current.ayah > surahInfo.totalAyahs) {
    return null;
  }

  if (current.ayah < surahInfo.totalAyahs) {
    return { surah: current.surah, ayah: current.ayah + 1 };
  }

  const nextSurah = getSurahInfo(current.surah + 1);
  return nextSurah ? { surah: nextSurah.number, ayah: 1 } : null;
}

export function getPreviousVerse(current: QuranVerseReference): QuranVerseReference | null {
  const surahInfo = getSurahInfo(current.surah);
  if (!surahInfo || current.ayah < 1 || current.ayah > surahInfo.totalAyahs) return null;
  if (current.ayah > 1) return { surah: current.surah, ayah: current.ayah - 1 };
  const previousSurah = getSurahInfo(current.surah - 1);
  return previousSurah ? { surah: previousSurah.number, ayah: previousSurah.totalAyahs } : null;
}
