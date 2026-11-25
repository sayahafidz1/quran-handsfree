import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Semua warna aplikasi ada sebagai variabel di dua blok palet: :root (terang) dan :root[data-theme="gelap"].
// Satu warna yang masih tertulis langsung di aturan lain akan tetap terang di mode gelap, jadi tes ini menjaganya.
const css = readFileSync(new URL("../src/ui/styles.css", import.meta.url), "utf8");
const blockOf = (start: string): { text: string; end: number } => {
  const from = css.indexOf(start);
  assert.ok(from >= 0, `blok ${start} tidak ada`);
  const end = css.indexOf("\n}\n", from);
  return { text: css.slice(from, end), end };
};
const light = blockOf(":root {");
const dark = blockOf(':root[data-theme="gelap"] {');
const rest = css.slice(0, css.indexOf(":root {")) + css.slice(light.end, css.indexOf(':root[data-theme="gelap"] {')) + css.slice(dark.end);
const tokens = (block: string): Record<string, string> =>
  Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]));
const lightTokens = tokens(light.text);
const darkTokens = tokens(dark.text);

test("colors are only written inside the two palette blocks", () => {
  const stray = rest.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|(?<![\w-])white\b(?!-)/g);
  assert.equal(stray, null, `warna tertulis langsung di luar blok palet: ${stray?.join(", ")}`);
});

test("every var(--x) that is used is defined, and every token is used", () => {
  const used = new Set([...rest.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]));
  for (const name of used) {
    if (name === "arabic-scale") continue; // diatur oleh app.ts, bukan warna
    assert.ok(name in lightTokens, `--${name} dipakai tetapi tidak didefinisikan di :root`);
  }
  for (const name of Object.keys(lightTokens)) assert.ok(used.has(name), `--${name} didefinisikan tetapi tidak dipakai`);
});

test("palette tokens hold plain color values", () => {
  for (const [name, value] of [...Object.entries(lightTokens), ...Object.entries(darkTokens)]) {
    assert.match(value, /^#[0-9a-fA-F]{3,8}$/, `--${name} bukan nilai warna heks: "${value}"`);
  }
});

test("the dark palette defines exactly the same tokens as the light one", () => {
  assert.deepEqual(Object.keys(darkTokens).sort(), Object.keys(lightTokens).sort());
});

// Kontras teks (WCAG): pasangan yang benar-benar dipakai di aplikasi. Hanya palet gelap yang dikunci di 4,5; palet terang
// sudah ada sebelum tema dan sebagian pasangannya (mis. label emas) memang lebih rendah.
function luminance(hex: string): number {
  const h = hex.slice(1, 7);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const PAIRS: [string, string][] = [
  ["text", "bg"], ["text", "card"], ["text", "panel"], ["text", "current-bg"], ["text", "field"], ["text", "tint"], ["text", "highlight"],
  ["text-soft", "card"], ["text-soft", "bg"], ["text-body", "card"], ["text-chip", "chip-bg"],
  ["muted", "bg"], ["muted", "card"], ["muted", "panel"], ["muted", "current-bg"], ["muted-2", "bg"], ["muted-2", "card"], ["muted-3", "bg"],
  ["heading", "bg"], ["heading", "card"], ["heading", "tint"], ["heading", "current-bg"],
  ["gold", "bg"], ["gold", "card"],
  ["on-primary", "primary"], ["on-primary", "gold"], ["on-primary", "rec"], ["on-primary", "danger-solid"], ["on-primary-soft", "primary"],
  ["danger", "panel"], ["danger", "card"], ["danger", "current-bg"], ["danger-text", "danger-bg"], ["danger-text", "card"], ["danger-text", "danger-chip-bg"],
  ["error", "card"], ["error", "bg"], ["ok", "card"], ["ok", "bg"], ["warn", "card"], ["warn", "bg"], ["done-text", "done-bg"]
];
test("dark palette: every text and background pair used by the app has contrast of at least 4.5", () => {
  const low = PAIRS.map(([fg, bg]) => ({ fg, bg, ratio: contrast(darkTokens[fg], darkTokens[bg]) }))
    .filter((p) => p.ratio < 4.5)
    .map((p) => `--${p.fg} (${darkTokens[p.fg]}) di atas --${p.bg} (${darkTokens[p.bg]}) hanya ${p.ratio.toFixed(2)}`);
  assert.deepEqual(low, []);
});
