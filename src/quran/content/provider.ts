import { getSurahInfo } from "../validator.ts";
import type {
  AyahReference,
  JuzMetadata,
  QuranAyah,
  QuranContentAsset,
  QuranContentProvider,
  QuranSurah,
  QuranWord
} from "./types.ts";

const JUZ_STARTS: AyahReference[] = [
  { surah: 1, ayah: 1 }, { surah: 2, ayah: 142 }, { surah: 2, ayah: 253 },
  { surah: 3, ayah: 93 }, { surah: 4, ayah: 24 }, { surah: 4, ayah: 148 },
  { surah: 5, ayah: 82 }, { surah: 6, ayah: 111 }, { surah: 7, ayah: 88 },
  { surah: 8, ayah: 41 }, { surah: 9, ayah: 93 }, { surah: 11, ayah: 6 },
  { surah: 12, ayah: 53 }, { surah: 15, ayah: 1 }, { surah: 17, ayah: 1 },
  { surah: 18, ayah: 75 }, { surah: 21, ayah: 1 }, { surah: 23, ayah: 1 },
  { surah: 25, ayah: 21 }, { surah: 27, ayah: 56 }, { surah: 29, ayah: 46 },
  { surah: 33, ayah: 31 }, { surah: 36, ayah: 28 }, { surah: 39, ayah: 32 },
  { surah: 41, ayah: 47 }, { surah: 46, ayah: 1 }, { surah: 51, ayah: 31 },
  { surah: 58, ayah: 1 }, { surah: 67, ayah: 1 }, { surah: 78, ayah: 1 }
];

function compareReferences(a: AyahReference, b: AyahReference): number {
  return a.surah - b.surah || a.ayah - b.ayah;
}

function toWords(text: string): QuranWord[] {
  return text.trim() ? text.trim().split(/\s+/).map((word, index) => ({ index, text: word })) : [];
}

export class OfflineQuranContentProvider implements QuranContentProvider {
  private readonly surahs: QuranSurah[];
  private readonly byReference = new Map<string, QuranAyah>();
  private readonly juz: JuzMetadata[];

  public constructor(asset: QuranContentAsset) {
    this.surahs = asset.surahs
      .map((source) => {
        const metadata = getSurahInfo(source.number);
        if (!metadata) return undefined;
        const ayahs = source.ayahs
          .filter((ayah) => Number.isInteger(ayah.ayah) && typeof ayah.text === "string")
          .map((ayah) => ({
            surah: source.number,
            ayah: ayah.ayah,
            text: ayah.text.replace(/^\uFEFF/, ""),
            words: toWords(ayah.text.replace(/^\uFEFF/, ""))
          }));
        return {
          number: source.number,
          name: source.name ?? metadata.name,
          arabicName: source.arabicName ?? metadata.arabicName,
          ayahs
        };
      })
      .filter((surah): surah is QuranSurah => surah !== undefined)
      .sort((a, b) => a.number - b.number);

    for (const surah of this.surahs) {
      for (const ayah of surah.ayahs) this.byReference.set(this.key(ayah), ayah);
    }

    this.juz = JUZ_STARTS.map((start, index) => ({
      number: index + 1,
      start,
      end: this.findEnd(index)
    }));
  }

  public getSurahs(): readonly QuranSurah[] { return this.surahs; }
  public getSurah(number: number): QuranSurah | undefined {
    return this.surahs.find((surah) => surah.number === number);
  }
  public getJuz(number: number): JuzMetadata | undefined {
    return Number.isInteger(number) && number >= 1 && number <= this.juz.length ? this.juz[number - 1] : undefined;
  }
  public getAyah(reference: AyahReference): QuranAyah | undefined {
    return this.byReference.get(this.key(reference));
  }
  public getAyahs(surah: number): readonly QuranAyah[] {
    return this.getSurah(surah)?.ayahs ?? [];
  }
  public getWords(reference: AyahReference): readonly QuranWord[] {
    return this.getAyah(reference)?.words ?? [];
  }
  public getJuzAyahs(number: number): QuranAyah[] {
    const range = this.getJuz(number);
    if (!range) return [];
    return this.surahs.flatMap((surah) => surah.ayahs.filter((ayah) => {
      const ref = { surah: ayah.surah, ayah: ayah.ayah };
      return compareReferences(ref, range.start) >= 0 && compareReferences(ref, range.end) <= 0;
    }));
  }

  private findEnd(index: number): AyahReference {
    const next = JUZ_STARTS[index + 1];
    if (next) {
      if (next.ayah > 1) return { surah: next.surah, ayah: next.ayah - 1 };
      const prior = this.surahs.filter((surah) => surah.number < next.surah).at(-1);
      return { surah: prior?.number ?? next.surah, ayah: prior?.ayahs.at(-1)?.ayah ?? 0 };
    }
    const last = this.surahs.at(-1);
    return { surah: last?.number ?? 114, ayah: last?.ayahs.at(-1)?.ayah ?? 0 };
  }

  private key(reference: AyahReference): string {
    return `${reference.surah}:${reference.ayah}`;
  }
}

export async function loadOfflineQuranContent(url = "/quran/content.json"): Promise<OfflineQuranContentProvider> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load Quran content (${response.status})`);
  return new OfflineQuranContentProvider(await response.json() as QuranContentAsset);
}
