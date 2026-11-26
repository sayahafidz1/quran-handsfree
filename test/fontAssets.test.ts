import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Menjaga font Qur'an yang ikut di dalam aplikasi: berkasnya ada dan asli, dipakai CSS, ikut di cache offline,
// dan lisensinya tercatat (Scheherazade New: SIL OFL; KFGQPC Hafs: hak Kompleks Raja Fahd, bukan OFL).
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("src/ui/styles.css");
const fontFaces = [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map((match) => {
  const block = match[0];
  return {
    family: block.match(/font-family:\s*["']([^"']+)["']/)?.[1] ?? "",
    url: block.match(/url\(["']?([^"')]+)["']?\)/)?.[1] ?? ""
  };
});
const faceOf = (family: string) => fontFaces.find((face) => face.family === family);

test("there are exactly two @font-face rules: KFGQPC Hafs and Scheherazade New", () => {
  assert.deepEqual(fontFaces.map((face) => face.family).sort(), ["KFGQPC Uthmanic Script HAFS", "Scheherazade New"]);
});

test("every @font-face points to a real TrueType file in public/fonts", () => {
  for (const face of fontFaces) {
    assert.ok(face.url.startsWith("/fonts/"), `url font tidak ditemukan untuk ${face.family}: "${face.url}"`);
    const path = new URL(`../public${face.url}`, import.meta.url);
    assert.ok(existsSync(path), `berkas ${face.url} tidak ada di public/`);
    const bytes = readFileSync(path);
    assert.ok(bytes.length > 100_000, `${face.url} terlalu kecil untuk font Arab lengkap`);
    assert.equal(bytes.readUInt32BE(0), 0x00010000, `${face.url} bukan berkas TrueType (.ttf)`);
  }
});

test("the Arabic text defaults to Scheherazade with KFGQPC as the fallback, and the choice can switch the order", () => {
  const arabicRule = css.match(/\.arabic-text\s*\{[^}]*\}/)?.[0] ?? "";
  const stack = arabicRule.match(/font-family:\s*([^;]+);/)?.[1] ?? "";
  assert.ok(stack.indexOf('"Scheherazade New"') >= 0, ".arabic-text tidak memakai Scheherazade");
  assert.ok(stack.indexOf('"Scheherazade New"') < stack.indexOf('"KFGQPC Uthmanic Script HAFS"'), "Scheherazade harus lebih dulu");
  const switched = css.match(/:root\[data-arabic-font="kfgqpc"\]\s+\.arabic-text\s*\{[^}]*\}/)?.[0] ?? "";
  const switchedStack = switched.match(/font-family:\s*([^;]+);/)?.[1] ?? "";
  assert.ok(switchedStack.startsWith('"KFGQPC Uthmanic Script HAFS"'), "pilihan KFGQPC tidak mendahulukan KFGQPC");
});

test("both fonts are part of the offline app shell and the cache version was bumped", () => {
  const sw = read("public/sw.js");
  const shell = sw.match(/APP_SHELL\s*=\s*\[[^\]]*\]/)?.[0] ?? "";
  for (const face of fontFaces) assert.ok(shell.includes(`"${face.url}"`), `${face.url} tidak ada di APP_SHELL`);
  assert.ok(!sw.includes("quran-handsfree-v6"), "versi cache belum dinaikkan dari v6");
  assert.ok(!sw.includes("Amiri"), "sw.js masih menyebut font lama");
});

test("the OFL license ships with Scheherazade New and is credited in the notices and the About screen", () => {
  const license = read("public/fonts/OFL.txt");
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(license, /SIL Global/);
  const notices = read("docs/THIRD_PARTY_NOTICES.md");
  assert.match(notices, /Scheherazade New/);
  assert.match(notices, /SIL Open Font License|OFL/);
  assert.match(read("index.html"), /Scheherazade New/);
  assert.ok(!existsSync(new URL("../public/fonts/Amiri-Regular.ttf", import.meta.url)), "font lama masih ada di public/fonts");
});

test("KFGQPC Hafs ships with its own notice (not OFL) and is credited in the notices and the About screen", () => {
  const face = faceOf("KFGQPC Uthmanic Script HAFS");
  assert.ok(face, "@font-face KFGQPC tidak ada");
  const notice = read("public/fonts/KFGQPC-NOTICE.txt");
  assert.match(notice, /King Fahd Glorious Quran Printing Complex/);
  assert.match(notice, /BUKAN berlisensi SIL OFL/);
  const notices = read("docs/THIRD_PARTY_NOTICES.md");
  assert.match(notices, /KFGQPC/);
  assert.match(notices, /bukan OFL|BUKAN OFL|bukan berlisensi OFL/i);
  assert.match(read("index.html"), /KFGQPC Uthmanic Script HAFS/);
});
