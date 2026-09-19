import test from "node:test";
import assert from "node:assert/strict";
import { OfflineQuranContentProvider } from "../src/quran/content/index.ts";

const provider = new OfflineQuranContentProvider({
  surahs: [
    { number: 1, ayahs: [
      { ayah: 1, text: "بِسْمِ اللَّهِ" },
      { ayah: 2, text: "الْحَمْدُ لِلَّهِ" }
    ] },
    { number: 2, ayahs: [
      { ayah: 141, text: "تِلْكَ أُمَّةٌ" },
      { ayah: 142, text: "سَيَقُولُ السُّفَهَاءُ" }
    ] }
  ]
});

test("provides stable ayah words and safe invalid references", () => {
  assert.deepEqual(provider.getWords({ surah: 1, ayah: 1 }), [
    { index: 0, text: "بِسْمِ" },
    { index: 1, text: "اللَّهِ" }
  ]);
  assert.equal(provider.getAyah({ surah: 99, ayah: 1 }), undefined);
  assert.deepEqual(provider.getWords({ surah: 1, ayah: 99 }), []);
});

test("maps juz boundaries to ayahs", () => {
  assert.deepEqual(provider.getJuz(1), { number: 1, start: { surah: 1, ayah: 1 }, end: { surah: 2, ayah: 141 } });
  assert.deepEqual(provider.getJuzAyahs(1).map(({ surah, ayah }) => `${surah}:${ayah}`), ["1:1", "1:2", "2:141"]);
  assert.equal(provider.getJuz(31), undefined);
});
