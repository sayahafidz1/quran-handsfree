import { SURAH_DATA } from "./surahData.ts";
import type { QuranValidationResult, SurahInfo } from "./types.ts";

const SURAH_BY_NUMBER = new Map<number, SurahInfo>();
const ALIAS_MAP = new Map<string, SurahInfo>();

for (const surah of SURAH_DATA) {
  SURAH_BY_NUMBER.set(surah.number, surah);

  // Register normalized name
  const normName = normalizeText(surah.name);
  ALIAS_MAP.set(normName, surah);
  ALIAS_MAP.set(normName.replace(/[\s-]/g, ""), surah);

  // Register arabic name
  ALIAS_MAP.set(surah.arabicName.trim(), surah);

  // Register aliases
  for (const alias of surah.aliases) {
    const normAlias = normalizeText(alias);
    ALIAS_MAP.set(normAlias, surah);
    ALIAS_MAP.set(normAlias.replace(/[\s-]/g, ""), surah);
  }
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/['’ʻʼ`"]/g, "") // remove quotes/apostrophes
    .replace(/[-_.,;:!?()[\]{}]/g, " ") // replace punctuation with space
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanSurahPrefix(text: string): string {
  const norm = normalizeText(text);
  return norm
    .replace(/^(buka|pindah ke|loncat ke|pergi ke|ke|baca)\s+/, "")
    .replace(/^(surat ke|surah ke|surat|surah)\s+/, "")
    .trim();
}

export function getSurahInfo(surahNumber: number): SurahInfo | undefined {
  return SURAH_BY_NUMBER.get(surahNumber);
}

export function isValidSurah(surahNumber: number): boolean {
  return SURAH_BY_NUMBER.has(surahNumber);
}

export function isValidAyah(surahNumber: number, ayahNumber: number): boolean {
  const info = SURAH_BY_NUMBER.get(surahNumber);
  if (!info) return false;
  return Number.isInteger(ayahNumber) && ayahNumber >= 1 && ayahNumber <= info.totalAyahs;
}

export function findSurahByNameOrAlias(query: string): SurahInfo | undefined {
  if (!query || !query.trim()) return undefined;

  const rawClean = cleanSurahPrefix(query);
  const rawCleanNoSpace = rawClean.replace(/\s+/g, "");

  // Check if query is directly a surah number (e.g. "2" or "surat 2")
  const asNumber = parseInt(rawClean, 10);
  if (!isNaN(asNumber) && String(asNumber) === rawClean) {
    return SURAH_BY_NUMBER.get(asNumber);
  }

  // Exact match in map
  if (ALIAS_MAP.has(rawClean)) {
    return ALIAS_MAP.get(rawClean);
  }

  if (ALIAS_MAP.has(rawCleanNoSpace)) {
    return ALIAS_MAP.get(rawCleanNoSpace);
  }

  // Match without leading "al " or "an " or "ar " or "at " or "as " or "az " etc.
  const strippedPrefix = rawClean.replace(/^(al|an|ar|at|as|az|ad|ash|asy|adh|adz)\s+/, "");
  if (ALIAS_MAP.has(strippedPrefix)) {
    return ALIAS_MAP.get(strippedPrefix);
  }

  // Iterate to find prefix / substring match for partial or spoken aliases
  for (const [aliasKey, info] of ALIAS_MAP.entries()) {
    if (aliasKey.length >= 3 && (rawClean === aliasKey || rawClean.startsWith(aliasKey + " ") || aliasKey.startsWith(rawClean + " "))) {
      return info;
    }
  }

  return undefined;
}

export function validateSurahAndAyah(surahNumber: number, ayahNumber: number): QuranValidationResult {
  const surahInfo = getSurahInfo(surahNumber);
  if (!surahInfo) {
    return {
      valid: false,
      reason: "invalid_surah",
      message: `Nomor surat ${surahNumber} tidak valid. Al-Qur'an terdiri dari 114 surat (1-114).`,
      surah: surahNumber,
      ayah: ayahNumber
    };
  }

  if (!Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > surahInfo.totalAyahs) {
    return {
      valid: false,
      reason: "invalid_ayah",
      message: `Ayat ${ayahNumber} tidak valid untuk Surat ${surahInfo.name}. Surat ini memiliki ${surahInfo.totalAyahs} ayat (1-${surahInfo.totalAyahs}).`,
      surah: surahNumber,
      ayah: ayahNumber,
      surahInfo
    };
  }

  return {
    valid: true,
    surah: surahNumber,
    ayah: ayahNumber,
    surahInfo
  };
}
