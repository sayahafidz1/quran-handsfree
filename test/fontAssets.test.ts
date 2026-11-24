import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Menjaga font Qur'an yang ikut di dalam aplikasi: berkasnya ada dan asli, dipakai CSS, ikut di cache offline,
// dan lisensinya (SIL OFL) ikut terkemas serta tercatat.
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("src/ui/styles.css");
const fontFace = css.match(/@font-face\s*\{[^}]*\}/)?.[0] ?? "";
const fontUrl = fontFace.match(/url\(["']?([^"')]+)["']?\)/)?.[1] ?? "";

test("@font-face points to a font file that exists in public/", () => {
  assert.ok(fontUrl.startsWith("/fonts/"), `url font tidak ditemukan di @font-face: "${fontUrl}"`);
  assert.ok(existsSync(new URL(`../public${fontUrl}`, import.meta.url)), `berkas ${fontUrl} tidak ada di public/`);
});

test("the font file is a real TrueType font, not an HTML fallback page saved under a font name", () => {
  const bytes = readFileSync(new URL(`../public${fontUrl}`, import.meta.url));
  assert.ok(bytes.length > 100_000, "font terlalu kecil untuk font Arab lengkap");
  assert.equal(bytes.readUInt32BE(0), 0x00010000, "bukan berkas TrueType (.ttf)");
});

test("the Arabic text uses the family declared in @font-face", () => {
  const family = fontFace.match(/font-family:\s*["']([^"']+)["']/)?.[1];
  assert.ok(family, "@font-face tanpa font-family");
  const arabicRule = css.match(/\.arabic-text\s*\{[^}]*\}/)?.[0] ?? "";
  assert.ok(arabicRule.includes(`"${family}"`), `.arabic-text tidak memakai "${family}"`);
});

test("the font is part of the offline app shell and the cache version was bumped", () => {
  const sw = read("public/sw.js");
  assert.ok(sw.match(/APP_SHELL\s*=\s*\[[^\]]*\]/)?.[0].includes(`"${fontUrl}"`), "font tidak ada di APP_SHELL");
  assert.ok(!sw.includes("quran-handsfree-v5"), "versi cache belum dinaikkan dari v5");
  assert.ok(!sw.includes("Amiri"), "sw.js masih menyebut font lama");
});

test("the OFL license ships with the font and is credited in the notices and the About screen", () => {
  const license = read("public/fonts/OFL.txt");
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(license, /SIL Global/);
  const notices = read("docs/THIRD_PARTY_NOTICES.md");
  assert.match(notices, /Scheherazade New/);
  assert.match(notices, /SIL Open Font License|OFL/);
  assert.match(read("index.html"), /Scheherazade New/);
  assert.ok(!existsSync(new URL("../public/fonts/Amiri-Regular.ttf", import.meta.url)), "font lama masih ada di public/fonts");
});
