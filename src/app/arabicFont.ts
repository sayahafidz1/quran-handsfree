import type { FlagStorage } from "./modelReadyFlag.ts";

/**
 * Pilihan font teks Arab (tab Pengaturan). Murni: storage disuntikkan dan boleh tidak ada atau menolak bekerja
 * (pilihan tetap berlaku selama aplikasi terbuka). Pembacaan hanya menerima teks persis salah satu id.
 * Font dan tumpukan cadangannya didefinisikan di styles.css (`.arabic-text` dan `:root[data-arabic-font=...]`);
 * modul ini hanya memilih dan mengingat. Menambah font: tambah satu entri di sini, satu aturan CSS, satu @font-face.
 */
export interface ArabicFontOption {
  id: "kfgqpc" | "scheherazade";
  label: string;
  note: string;
}

export const ARABIC_FONTS: readonly ArabicFontOption[] = [
  { id: "kfgqpc", label: "KFGQPC Hafs", note: "Bawaan. Gaya mushaf Madinah." },
  { id: "scheherazade", label: "Scheherazade New", note: "Huruf lebih lebar dan jelas." }
];
export type ArabicFontId = ArabicFontOption["id"];
export const DEFAULT_ARABIC_FONT: ArabicFontId = "kfgqpc";
export const ARABIC_FONT_KEY = "quran-handsfree:arabic-font";

export interface ArabicFont {
  choice(): ArabicFontId;
  /** Pilih font dan simpan. */
  set(id: ArabicFontId): void;
}

export function createArabicFont(storage: FlagStorage | null): ArabicFont {
  let current: ArabicFontId = DEFAULT_ARABIC_FONT;
  try {
    const stored = storage?.getItem(ARABIC_FONT_KEY);
    const found = ARABIC_FONTS.find((font) => font.id === stored);
    if (found) current = found.id;
  } catch {
    // penyimpanan tidak bisa dibaca: pakai bawaan
  }
  return {
    choice: () => current,
    set(id) {
      current = id;
      try {
        storage?.setItem(ARABIC_FONT_KEY, id);
      } catch {
        // penyimpanan menolak: pilihan tetap berlaku selama aplikasi terbuka
      }
    }
  };
}
