import { findSurahByNameOrAlias, getSurahInfo, normalizeText, validateSurahAndAyah } from "../quran/index.ts";
import { parseNumberString } from "./numberParser.ts";
import type { ParseCommandResult, ParseCommandSuccess, ParseCommandFailure, ReaderControlCommand } from "./types.ts";

export function parseReaderCommand(rawInput: string): ParseCommandResult {
  if (!rawInput || !rawInput.trim()) {
    return {
      success: false,
      reason: "unrecognized_command",
      message: "Perintah suara kosong atau tidak terdengar.",
      rawText: rawInput || ""
    };
  }

  const rawText = rawInput.trim();
  const normalized = normalizeText(rawText);

  // Clean filler conversational prefixes
  const cleanInput = normalized
    .replace(/^(tolong|mohon|coba|silakan)\s+/, "")
    .replace(/^(buka|pindah ke|loncat ke|pergi ke|baca|navigasi ke|ke)\s+/, "")
    .trim();

  const controlCommand = parseControlCommand(cleanInput, rawText);
  if (controlCommand) return controlCommand;

  // Pattern 1: Inverted "ayat [X] (di)? surat [Y]"
  const invertedMatch = cleanInput.match(/^ayat(?:\s+ke|-)?\s+(.+?)\s+(?:di\s+)?(?:surat|surah)\s+(.+)$/);
  if (invertedMatch) {
    const ayahStr = invertedMatch[1].trim();
    const surahStr = invertedMatch[2].trim();
    return resolveSurahAndAyah(surahStr, ayahStr, rawText);
  }

  // Pattern 2: Standard "[Surat Y] ayat [X]"
  const standardAyatMatch = cleanInput.match(/^(.+?)\s+ayat(?:\s+ke|-)?\s+(.+)$/);
  if (standardAyatMatch) {
    const surahStr = standardAyatMatch[1].trim();
    const ayahStr = standardAyatMatch[2].trim();
    return resolveSurahAndAyah(surahStr, ayahStr, rawText);
  }

  // Pattern 3: Explicit "surat [Y] [X]" where X is number or number words
  const explicitSuratMatch = cleanInput.match(/^(?:surat|surah)\s+(.+)$/);
  if (explicitSuratMatch) {
    const content = explicitSuratMatch[1].trim();

    // Check if ends with number digits or words
    const tokens = content.split(/\s+/);
    for (let splitIdx = 1; splitIdx < tokens.length; splitIdx++) {
      const leftPart = tokens.slice(0, splitIdx).join(" ");
      const rightPart = tokens.slice(splitIdx).join(" ");

      const candidateAyah = parseNumberString(rightPart);
      if (candidateAyah !== null) {
        const candidateSurah = resolveSurah(leftPart);
        if (candidateSurah.found) {
          return resolveSurahAndAyah(leftPart, rightPart, rawText);
        }
      }
    }

    // If only surah is mentioned without ayah
    const singleSurah = resolveSurah(content);
    if (singleSurah.found && singleSurah.surahInfo) {
      return {
        success: false,
        reason: "missing_ayah",
        message: `Surat ${singleSurah.surahInfo.name} terdeteksi, silakan sebutkan nomor ayat (contoh: "${singleSurah.surahInfo.name} ayat 1").`,
        rawText,
        surah: singleSurah.surahInfo.number,
        surahInfo: singleSurah.surahInfo,
        maxAyah: singleSurah.surahInfo.totalAyahs
      };
    }

  }

  // Pattern 4: Name + Number without explicit "ayat" keyword (e.g. "Al Baqarah 255", "Yasin 58")
  const tokens = cleanInput.split(/\s+/);
  for (let splitIdx = 1; splitIdx < tokens.length; splitIdx++) {
    const leftPart = tokens.slice(0, splitIdx).join(" ");
    const rightPart = tokens.slice(splitIdx).join(" ");

    const candidateAyah = parseNumberString(rightPart);
    if (candidateAyah !== null) {
      const candidateSurah = resolveSurah(leftPart);
      if (candidateSurah.found) {
        return resolveSurahAndAyah(leftPart, rightPart, rawText);
      }
    }
  }

  // Check if just surah name was mentioned
  const surahOnly = resolveSurah(cleanInput);
  if (surahOnly.found && surahOnly.surahInfo) {
    return {
      success: false,
      reason: "missing_ayah",
      message: `Surat ${surahOnly.surahInfo.name} terdeteksi. Silakan sebutkan nomor ayat (1-${surahOnly.surahInfo.totalAyahs}).`,
      rawText,
      surah: surahOnly.surahInfo.number,
      surahInfo: surahOnly.surahInfo,
      maxAyah: surahOnly.surahInfo.totalAyahs
    };
  }

  return {
    success: false,
    reason: "unrecognized_command",
    message: `Perintah "${rawText}" tidak dikenali sebagai navigasi surat dan ayat. Format contoh: "Al-Baqarah ayat 255", "Surat Yasin ayat 58".`,
    rawText
  };
}

export function parseNavigationCommand(rawInput: string): ParseCommandSuccess | ParseCommandFailure {
  const result = parseReaderCommand(rawInput);
  if (result.success && result.command === "open") return result;
  if (!result.success) return result;
  return {
    success: false,
    reason: "unrecognized_command",
    message: `Perintah "${rawInput.trim()}" bukan navigasi surat dan ayat.`,
    rawText: rawInput.trim()
  };
}

function parseControlCommand(input: string, rawText: string): ParseCommandResult | null {
  const aliases: Array<[ReaderControlCommand, RegExp]> = [
    ["start", /^(mulai|start|mulai membaca|mulai mendengarkan|baca)$/],
    ["current", /^(kembali|kembali ke posisi|kembali ke posisi bacaan aktif|posisi aktif|posisi saat ini)$/],
    ["repeat", /^(ulang|baca ulang|ulang ayat|baca ulang ayat|ulangi)$/],
    ["next", /^(berikutnya|ayat berikutnya|next|next ayat|maju satu ayat)$/],
    ["previous", /^(sebelumnya|ayat sebelumnya|previous|previous ayat|mundur satu ayat)$/],
    ["stop", /^(berhenti|stop|berhenti mendengarkan|stop listening|berhenti listening)$/],
    ["resume", /^(lanjut|lanjutkan|resume|resume listening|lanjut mendengarkan)$/]
  ];
  const match = aliases.find(([, pattern]) => pattern.test(input));
  return match ? { success: true, command: match[0], rawText } : null;
}

interface SurahResolveResult {
  found: boolean;
  surahNumber?: number;
  surahInfo?: ReturnType<typeof getSurahInfo>;
  isNumberOutOfRange?: boolean;
}

function resolveSurah(surahQuery: string): SurahResolveResult {
  const clean = surahQuery
    .replace(/^(surat ke|surah ke|surat|surah)\s+/, "")
    .trim();

  // Try parsing as number
  const parsedNumber = parseNumberString(clean);
  if (parsedNumber !== null) {
    if (parsedNumber >= 1 && parsedNumber <= 114) {
      const info = getSurahInfo(parsedNumber);
      return { found: true, surahNumber: parsedNumber, surahInfo: info };
    } else {
      return { found: false, surahNumber: parsedNumber, isNumberOutOfRange: true };
    }
  }

  // Lookup by name / alias
  const info = findSurahByNameOrAlias(clean);
  if (info) {
    return { found: true, surahNumber: info.number, surahInfo: info };
  }

  return { found: false };
}

function resolveSurahAndAyah(surahQuery: string, ayahQuery: string, rawText: string): ParseCommandResult {
  const surahRes = resolveSurah(surahQuery);

  if (surahRes.isNumberOutOfRange && surahRes.surahNumber) {
    return {
      success: false,
      reason: "invalid_surah",
      message: `Nomor surat ${surahRes.surahNumber} tidak valid. Al-Qur'an terdiri dari 114 surat (1-114).`,
      rawText,
      surah: surahRes.surahNumber
    };
  }

  if (!surahRes.found || !surahRes.surahInfo) {
    return {
      success: false,
      reason: "invalid_surah",
      message: `Surat "${surahQuery}" tidak ditemukan dalam daftar 114 surat Al-Qur'an.`,
      rawText
    };
  }

  const ayahNum = parseNumberString(ayahQuery);
  if (ayahNum === null) {
    return {
      success: false,
      reason: "missing_ayah",
      message: `Nomor ayat "${ayahQuery}" tidak dapat dipahami. Sebutkan angka ayat dengan jelas (contoh: "ayat 10").`,
      rawText,
      surah: surahRes.surahInfo.number,
      surahInfo: surahRes.surahInfo,
      maxAyah: surahRes.surahInfo.totalAyahs
    };
  }

  const validation = validateSurahAndAyah(surahRes.surahInfo.number, ayahNum);
  if (!validation.valid) {
    return {
      success: false,
      reason: validation.reason,
      message: validation.message,
      rawText,
      surah: surahRes.surahInfo.number,
      ayah: ayahNum,
      surahInfo: surahRes.surahInfo,
      maxAyah: surahRes.surahInfo.totalAyahs
    };
  }

  return {
    success: true,
    command: "open",
    surah: validation.surah,
    ayah: validation.ayah,
    surahInfo: validation.surahInfo,
    surahName: validation.surahInfo.name,
    totalAyahs: validation.surahInfo.totalAyahs,
    rawText
  };
}
