import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Semua warna aplikasi ada sebagai variabel di blok :root. Mode gelap nanti cukup menimpa blok itu; satu warna
// yang masih tertulis langsung di aturan lain akan tetap terang di mode gelap, jadi tes ini menjaganya.
const css = readFileSync(new URL("../src/ui/styles.css", import.meta.url), "utf8");
const rootEnd = css.indexOf("\n}\n", css.indexOf(":root {"));
const rootBlock = css.slice(css.indexOf(":root {"), rootEnd);
const rest = css.slice(rootEnd);

test("colors are only written inside the :root block", () => {
  const stray = rest.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|(?<![\w-])white\b(?!-)/g);
  assert.equal(stray, null, `warna tertulis langsung di luar :root: ${stray?.join(", ")}`);
});

test("every var(--x) that is used is defined in :root, and every color token is used", () => {
  const defined = new Set([...rootBlock.matchAll(/--([\w-]+):/g)].map((m) => m[1]));
  const used = new Set([...rest.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]));
  for (const name of used) {
    if (name === "arabic-scale") continue; // diatur oleh app.ts, bukan warna
    assert.ok(defined.has(name), `--${name} dipakai tetapi tidak didefinisikan di :root`);
  }
  for (const name of defined) assert.ok(used.has(name), `--${name} didefinisikan tetapi tidak dipakai`);
});

test("color tokens hold plain color values", () => {
  for (const [, name, value] of rootBlock.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    assert.match(value, /^#[0-9a-fA-F]{3,8}$/, `--${name} bukan nilai warna heks: "${value}"`);
  }
});
