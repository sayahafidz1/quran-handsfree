import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARABIC_LEVEL_NAMES,
  ARABIC_SCALES,
  ARABIC_SIZE_KEY,
  DEFAULT_ARABIC_LEVEL,
  createArabicSize
} from "../src/app/displaySettings.ts";

function memoryStorage(initial?: Record<string, string>) {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

test("there are five levels and the middle one is the size before this setting existed", () => {
  assert.equal(ARABIC_SCALES.length, 5);
  assert.equal(DEFAULT_ARABIC_LEVEL, 2);
  assert.equal(ARABIC_SCALES[DEFAULT_ARABIC_LEVEL], 1);
  assert.deepEqual([...ARABIC_SCALES].sort((a, b) => a - b), [...ARABIC_SCALES], "tingkat harus naik berurutan");
});

test("starts at the default level when nothing is stored", () => {
  const size = createArabicSize(memoryStorage());
  assert.equal(size.level(), DEFAULT_ARABIC_LEVEL);
  assert.equal(size.scale(), 1);
});

test("steps up and down by one level and returns the new level", () => {
  const size = createArabicSize(memoryStorage());
  assert.equal(size.step(1), 3);
  assert.equal(size.scale(), ARABIC_SCALES[3]);
  assert.equal(size.step(-1), 2);
  assert.equal(size.step(-1), 1);
  assert.equal(size.scale(), ARABIC_SCALES[1]);
});

test("cannot step past either end", () => {
  const size = createArabicSize(memoryStorage({ [ARABIC_SIZE_KEY]: "4" }));
  assert.equal(size.canStep(1), false);
  assert.equal(size.step(1), 4);
  assert.equal(size.scale(), ARABIC_SCALES[4]);
  for (let i = 0; i < 10; i += 1) size.step(-1);
  assert.equal(size.level(), 0);
  assert.equal(size.canStep(-1), false);
  assert.equal(size.canStep(1), true);
  assert.equal(size.step(-1), 0);
});

test("the choice is remembered by a new instance on the same storage", () => {
  const storage = memoryStorage();
  createArabicSize(storage).step(1);
  assert.equal(storage.data.get(ARABIC_SIZE_KEY), "3");
  assert.equal(createArabicSize(storage).level(), 3);
});

test("stored values that are not a valid level fall back to the default", () => {
  // Termasuk teks yang Number() anggap valid ("3 ", "02", "0x3", "3.0") tetapi bukan yang kita simpan.
  for (const bad of ["", " ", "abc", "-1", "5", "9", "2.5", "NaN", "Infinity", "1e1", "[]", "null", "3 ", " 3", "02", "+3", "3.0", "0x3", "__proto__", "constructor"]) {
    const size = createArabicSize(memoryStorage({ [ARABIC_SIZE_KEY]: bad }));
    assert.equal(size.level(), DEFAULT_ARABIC_LEVEL, `nilai tersimpan "${bad}" harus diabaikan`);
  }
});

test("every valid stored level is accepted, including the lowest one", () => {
  ARABIC_SCALES.forEach((scale, index) => {
    const size = createArabicSize(memoryStorage({ [ARABIC_SIZE_KEY]: String(index) }));
    assert.equal(size.level(), index);
    assert.equal(size.scale(), scale);
  });
});

test("a step that does nothing does not write to storage", () => {
  const storage = memoryStorage({ [ARABIC_SIZE_KEY]: "4" });
  const before = storage.data.get(ARABIC_SIZE_KEY);
  createArabicSize(storage).step(1);
  assert.equal(storage.data.get(ARABIC_SIZE_KEY), before);
});

test("missing or refusing storage never throws and the choice still works in this session", () => {
  const withoutStorage = createArabicSize(null);
  assert.equal(withoutStorage.level(), DEFAULT_ARABIC_LEVEL);
  assert.equal(withoutStorage.step(1), 3);

  const broken = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); }
  };
  const size = createArabicSize(broken);
  assert.equal(size.level(), DEFAULT_ARABIC_LEVEL);
  assert.equal(size.step(-1), 1);
  assert.equal(size.scale(), ARABIC_SCALES[1]);
});

// Penyambungan HTML, CSS, dan app.ts. app.ts memakai querySelector(...)! untuk tombol: id yang salah ketik akan
// melempar error saat start dan seluruh aplikasi tidak jalan, jadi kecocokannya dijaga di sini.
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the size controls live in the Pengaturan tab (not the reading bar) and app.ts looks them up by the same ids", () => {
  const html = read("index.html");
  const settingsView = html.slice(html.indexOf('id="view-pengaturan"'), html.indexOf('id="view-baca"'));
  const readerView = html.slice(html.indexOf('id="view-baca"'), html.indexOf('id="quran-reader"'));
  const app = read("src/app/app.ts");
  for (const id of ["arabic-smaller", "arabic-larger", "arabic-dots", "arabic-size-label"]) {
    assert.ok(settingsView.includes(`id="${id}"`), `#${id} tidak ada di tab Pengaturan`);
    assert.ok(!readerView.includes(`id="${id}"`), `#${id} masih ada di bar layar baca`);
    assert.ok(app.includes(`"#${id}"`) || app.includes(`"#${id} `), `app.ts tidak mencari #${id}`);
  }
});

test("the level dots and names match the number of levels", () => {
  const html = read("index.html");
  const dots = html.slice(html.indexOf('id="arabic-dots"'), html.indexOf("</div>", html.indexOf('id="arabic-dots"')));
  assert.equal(dots.match(/class="size-dot"/g)?.length, ARABIC_SCALES.length, "jumlah titik di HTML berbeda dari jumlah tingkat");
  assert.equal(ARABIC_LEVEL_NAMES.length, ARABIC_SCALES.length);
});

test("the sample verse in Pengaturan is the real text of Al-Fatihah 5 and uses the reader's own classes", () => {
  const html = read("index.html");
  const at = html.indexOf("sample-ayah");
  const sample = html.slice(html.lastIndexOf("<article", at), html.indexOf("</article>", at));
  assert.ok(sample.includes("reader-ayah") && sample.includes("arabic-text"), "ayat contoh tidak memakai kelas layar baca");
  const content = JSON.parse(read("public/quran/content.json"));
  const fatihah = content.surahs.find((s: { number?: number; id?: number }) => (s.number ?? s.id) === 1);
  const ayah5 = fatihah.ayahs.find((a: { number?: number; ayah?: number }) => (a.number ?? a.ayah) === 5).text.replace(/^\uFEFF/, "");
  assert.ok(sample.includes(ayah5), "teks ayat contoh berbeda dari content.json");
});

test("the Arabic text scales through the CSS variable that app.ts sets", () => {
  const arabicRule = read("src/ui/styles.css").match(/\.arabic-text\s*\{[^}]*\}/)?.[0] ?? "";
  assert.match(arabicRule, /var\(--arabic-scale,\s*1\)/, ".arabic-text tidak memakai --arabic-scale (bawaan 1)");
  assert.ok(read("src/app/app.ts").includes('"--arabic-scale"'), "app.ts tidak mengatur --arabic-scale");
});
