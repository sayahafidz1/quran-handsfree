import type { FlagStorage } from "./modelReadyFlag.ts";

/**
 * Pilihan tema: terang, gelap, atau ikut sistem (bawaan). Murni: storage disuntikkan dan boleh tidak ada atau menolak
 * bekerja (pilihan tetap berlaku selama aplikasi terbuka). Pembacaan hanya menerima teks persis salah satu pilihan.
 * Palet warnanya ada di styles.css (`:root[data-theme="gelap"]`); modul ini hanya memilih dan mengingat.
 */
export const THEME_CHOICES = ["terang", "gelap", "sistem"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type ResolvedTheme = "terang" | "gelap";
export const DEFAULT_THEME: ThemeChoice = "sistem";
/** Kunci ini juga dibaca oleh skrip kecil di index.html (agar tema benar sebelum tampilan pertama); dijaga tes. */
export const THEME_KEY = "quran-handsfree:theme";

/** Warna <meta name="theme-color"> (bilah status). Terang = nilai yang sudah ada; gelap = --bg palet gelap (dijaga tes). */
export const THEME_COLORS: Record<ResolvedTheme, string> = { terang: "#0b3b32", gelap: "#07120f" };

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === "sistem") return systemPrefersDark ? "gelap" : "terang";
  return choice;
}

export function themeHint(choice: ThemeChoice, resolved: ResolvedTheme): string {
  if (choice === "terang") return "Selalu terang, apa pun pengaturan ponsel.";
  if (choice === "gelap") return "Selalu gelap: hijau tua yang nyaman di malam hari.";
  return `Mengikuti pengaturan ponsel Anda (sekarang: ${resolved}).`;
}

export interface Theme {
  choice(): ThemeChoice;
  /** Pilih tema dan simpan. */
  set(choice: ThemeChoice): void;
}

export function createTheme(storage: FlagStorage | null): Theme {
  let current: ThemeChoice = DEFAULT_THEME;
  try {
    const stored = storage?.getItem(THEME_KEY);
    const found = THEME_CHOICES.find((choice) => choice === stored);
    if (found) current = found;
  } catch {
    // penyimpanan tidak bisa dibaca: pakai bawaan
  }
  return {
    choice: () => current,
    set(choice) {
      current = choice;
      try {
        storage?.setItem(THEME_KEY, choice);
      } catch {
        // penyimpanan menolak: pilihan tetap berlaku selama aplikasi terbuka
      }
    }
  };
}
