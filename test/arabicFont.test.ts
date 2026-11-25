import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ARABIC_FONTS, ARABIC_FONT_KEY, DEFAULT_ARABIC_FONT, createArabicFont } from "../src/app/arabicFont.ts";

function memoryStorage(initial?: Record<string, string>) {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the default font is KFGQPC", () => {
  assert.equal(DEFAULT_ARABIC_FONT, "kfgqpc");
  assert.equal(createArabicFont(memoryStorage()).choice(), "kfgqpc");
  assert.equal(createArabicFont(null).choice(), "kfgqpc");
});

test("the choice is remembered by a new instance on the same storage", () => {
  const storage = memoryStorage();
  createArabicFont(storage).set("scheherazade");
  assert.equal(storage.data.get(ARABIC_FONT_KEY), "scheherazade");
  assert.equal(createArabicFont(storage).choice(), "scheherazade");
});

test("every font id round-trips", () => {
  for (const font of ARABIC_FONTS) {
    const storage = memoryStorage();
    createArabicFont(storage).set(font.id);
    assert.equal(createArabicFont(storage).choice(), font.id);
  }
});

test("only the exact id is accepted when reading (no coercion, no case folding)", () => {
  for (const bad of ["", "KFGQPC", " kfgqpc", "amiri", "0", "null", "scheherazade "]) {
    assert.equal(createArabicFont(memoryStorage({ [ARABIC_FONT_KEY]: bad })).choice(), DEFAULT_ARABIC_FONT, `"${bad}"`);
  }
});

test("a storage that throws on read or write does not break the choice", () => {
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    }
  };
  const font = createArabicFont(broken);
  assert.equal(font.choice(), DEFAULT_ARABIC_FONT);
  font.set("scheherazade");
  assert.equal(font.choice(), "scheherazade");
});

test("the Pengaturan tab has one radio button per font, wired in app.ts", () => {
  const html = read("index.html");
  const view = html.slice(html.indexOf('id="view-pengaturan"'), html.indexOf('id="view-baca"'));
  assert.ok(view.includes('id="arabic-font-choices"'), "kartu Font Arab tidak ada di tab Pengaturan");
  assert.ok(view.includes('role="radiogroup"'));
  for (const font of ARABIC_FONTS) {
    assert.ok(view.includes(`data-arabic-font="${font.id}"`), `tombol ${font.id} tidak ada`);
    assert.ok(view.includes(font.label), `label ${font.label} tidak ada`);
  }
  assert.equal([...view.matchAll(/role="radio"/g)].length, ARABIC_FONTS.length);
  const app = read("src/app/app.ts");
  assert.ok(app.includes("dataset.arabicFont"), "app.ts tidak memasang data-arabic-font");
  assert.ok(app.includes("createArabicFont"), "app.ts tidak memakai createArabicFont");
});

test("every font option has a CSS sample class and a switch rule", () => {
  const css = read("src/ui/styles.css");
  for (const font of ARABIC_FONTS) assert.ok(css.includes(`font-option-sample-${font.id}`), `contoh huruf ${font.id} tidak punya gaya`);
  assert.ok(css.includes('[data-arabic-font="scheherazade"]'));
});
