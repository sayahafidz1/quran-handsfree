import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// app.ts memilih layar lewat data-tab (tombol) dan data-view (isi): satu yang tidak punya pasangan membuat tab
// yang tidak membuka apa-apa. Dijaga di sini karena tidak ada tes browser.
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const tabs = [...html.matchAll(/class="tab"[^>]*data-tab="([\w-]+)"/g)].map((m) => m[1]);
const views = [...html.matchAll(/class="view[^"]*"[^>]*data-view="([\w-]+)"/g)].map((m) => m[1]);

test("the tab bar has the four tabs, Pengaturan last", () => {
  assert.deepEqual(tabs, ["beranda", "cari", "info", "pengaturan"]);
});

test("every tab opens a screen that exists, and every screen except the reader has a tab", () => {
  for (const tab of tabs) assert.ok(views.includes(tab), `tab "${tab}" tidak punya layar data-view="${tab}"`);
  assert.deepEqual(views.filter((v) => v !== "baca" && !tabs.includes(v)), [], "ada layar tanpa tab");
  assert.ok(views.includes("baca"));
});

test("only the first tab is marked as the current page in the HTML", () => {
  assert.equal(html.match(/data-tab="[\w-]+"[^>]*aria-current="page"/g)?.length, 1);
});
