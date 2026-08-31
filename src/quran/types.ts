export interface SurahInfo {
  number: number;
  name: string;
  arabicName: string;
  totalAyahs: number;
  aliases: string[];
}

export interface QuranValidationSuccess {
  valid: true;
  surah: number;
  ayah: number;
  surahInfo: SurahInfo;
}

export interface QuranValidationFailure {
  valid: false;
  reason: "invalid_surah" | "invalid_ayah";
  message: string;
  surah?: number;
  ayah?: number;
  surahInfo?: SurahInfo;
}

export type QuranValidationResult = QuranValidationSuccess | QuranValidationFailure;
