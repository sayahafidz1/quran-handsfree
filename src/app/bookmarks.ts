import type { AyahReference } from "../quran/content/index.ts";

/** Bagian kecil dari `Storage` browser yang dipakai; mudah ditiru di tes. */
export interface BookmarkStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BookmarkStore {
  /** Bookmark manual, yang terbaru di urutan pertama. */
  list(): AyahReference[];
  /** Menyimpan bookmark. `false` bila sudah ada, referensi tidak sah, atau batas penuh. */
  add(reference: AyahReference): boolean;
  remove(reference: AyahReference): boolean;
  has(reference: AyahReference): boolean;
  /** Posisi terakhir dibaca otomatis (bukan bookmark manual). */
  getLastRead(): AyahReference | null;
  /** Menyimpan posisi terakhir; tidak menulis ulang bila posisinya sama. */
  setLastRead(reference: AyahReference): void;
}

export const BOOKMARKS_KEY = "quran-handsfree:bookmarks";
export const LAST_READ_KEY = "quran-handsfree:last-read";
export const MAX_BOOKMARKS = 50;

function isReference(value: unknown): value is AyahReference {
  if (typeof value !== "object" || value === null) return false;
  const { surah, ayah } = value as Record<string, unknown>;
  return Number.isInteger(surah) && Number.isInteger(ayah)
    && (surah as number) >= 1 && (surah as number) <= 114 && (ayah as number) >= 1;
}

function sameReference(a: AyahReference, b: AyahReference): boolean {
  return a.surah === b.surah && a.ayah === b.ayah;
}

/**
 * Penyimpanan bookmark di perangkat (tanpa internet). Data rusak atau storage yang
 * menolak (mode privat, penuh) tidak boleh merusak aplikasi: dianggap kosong.
 */
export function createBookmarkStore(storage: BookmarkStorage | null | undefined): BookmarkStore {
  const read = (key: string): unknown => {
    try {
      const raw = storage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const write = (key: string, value: unknown): boolean => {
    try {
      storage?.setItem(key, JSON.stringify(value));
      return Boolean(storage);
    } catch {
      return false;
    }
  };
  const load = (): AyahReference[] => {
    const data = read(BOOKMARKS_KEY);
    if (!Array.isArray(data)) return [];
    const result: AyahReference[] = [];
    for (const item of data) {
      if (isReference(item) && !result.some((existing) => sameReference(existing, item))) {
        result.push({ surah: item.surah, ayah: item.ayah });
      }
    }
    return result.slice(0, MAX_BOOKMARKS);
  };

  return {
    list: load,
    has: (reference) => load().some((item) => sameReference(item, reference)),
    add(reference) {
      if (!isReference(reference)) return false;
      const items = load();
      if (items.some((item) => sameReference(item, reference))) return false;
      if (items.length >= MAX_BOOKMARKS) return false;
      return write(BOOKMARKS_KEY, [{ surah: reference.surah, ayah: reference.ayah }, ...items]);
    },
    remove(reference) {
      const items = load();
      const kept = items.filter((item) => !sameReference(item, reference));
      if (kept.length === items.length) return false;
      return write(BOOKMARKS_KEY, kept);
    },
    getLastRead() {
      const data = read(LAST_READ_KEY);
      return isReference(data) ? { surah: data.surah, ayah: data.ayah } : null;
    },
    setLastRead(reference) {
      if (!isReference(reference)) return;
      const current = this.getLastRead();
      if (current && sameReference(current, reference)) return;
      write(LAST_READ_KEY, { surah: reference.surah, ayah: reference.ayah });
    }
  };
}
