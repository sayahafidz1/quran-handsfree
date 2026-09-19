export interface AyahReference {
  surah: number;
  ayah: number;
}

export interface QuranWord {
  index: number;
  text: string;
}

export interface QuranAyah extends AyahReference {
  text: string;
  words: QuranWord[];
}

export interface QuranSurah {
  number: number;
  name: string;
  arabicName: string;
  ayahs: QuranAyah[];
}

export interface JuzMetadata {
  number: number;
  start: AyahReference;
  end: AyahReference;
}

export interface QuranContentAsset {
  surahs: Array<{
    number: number;
    name?: string;
    arabicName?: string;
    ayahs: Array<{ ayah: number; text: string }>;
  }>;
}

export interface QuranContentProvider {
  getSurahs(): readonly QuranSurah[];
  getSurah(number: number): QuranSurah | undefined;
  getJuz(number: number): JuzMetadata | undefined;
  getAyah(reference: AyahReference): QuranAyah | undefined;
  getAyahs(surah: number): readonly QuranAyah[];
  getWords(reference: AyahReference): readonly QuranWord[];
  getJuzAyahs(number: number): QuranAyah[];
}
