import type { FlagStorage } from "./modelReadyFlag.ts";

/**
 * Ukuran huruf teks Arab di layar baca. Lima tingkat; tingkat tengah (DEFAULT_ARABIC_LEVEL) sama dengan ukuran
 * sebelum ada pengaturan ini. Pilihan diingat di perangkat. Murni: storage disuntikkan dan boleh tidak ada atau menolak
 * bekerja (pilihan tetap berlaku selama aplikasi terbuka).
 */
export const ARABIC_SCALES = [0.8, 0.9, 1, 1.25, 1.5] as const;
export const DEFAULT_ARABIC_LEVEL = 2;
export const ARABIC_SIZE_KEY = "quran-handsfree:arabic-size";

export interface ArabicSize {
  /** Tingkat sekarang, 0 sampai ARABIC_SCALES.length - 1. */
  level(): number;
  /** Pengali ukuran huruf untuk tingkat sekarang. */
  scale(): number;
  canStep(delta: 1 | -1): boolean;
  /** Geser satu tingkat (tidak melewati ujung), simpan, dan kembalikan tingkat baru. */
  step(delta: 1 | -1): number;
}

function isLevel(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < ARABIC_SCALES.length;
}

export function createArabicSize(storage: FlagStorage | null): ArabicSize {
  let level = DEFAULT_ARABIC_LEVEL;
  try {
    // Hanya teks persis seperti yang kita tulis sendiri ("0" sampai "4") yang diterima. Number() terlalu longgar:
    // Number(" ") bernilai 0 dan Number("3 ") bernilai 3, padahal keduanya bukan data yang kita simpan.
    const stored = ARABIC_SCALES.findIndex((_, index) => String(index) === storage?.getItem(ARABIC_SIZE_KEY));
    if (stored >= 0) level = stored;
  } catch {
    // storage menolak: pakai ukuran bawaan
  }

  const canStep = (delta: 1 | -1) => isLevel(level + delta);
  return {
    level: () => level,
    scale: () => ARABIC_SCALES[level],
    canStep,
    step(delta) {
      if (!canStep(delta)) return level;
      level += delta;
      try {
        storage?.setItem(ARABIC_SIZE_KEY, String(level));
      } catch {
        // storage menolak: pilihan hanya berlaku selama aplikasi terbuka
      }
      return level;
    }
  };
}
