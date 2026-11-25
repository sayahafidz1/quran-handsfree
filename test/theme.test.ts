import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_THEME, THEME_CHOICES, THEME_COLORS, THEME_KEY, createTheme, resolveTheme, themeHint } from "../src/app/theme.ts";

function memoryStorage(initial?: Record<string, string>) {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

test("the default is to follow the system", () => {
  assert.equal(DEFAULT_THEME, "sistem");
  assert.equal(createTheme(memoryStorage()).choice(), "sistem");
});

test("the choice is remembered by a new instance on the same storage", () => {
  const storage = memoryStorage();
  createTheme(storage).set("gelap");
  assert.equal(storage.data.get(THEME_KEY), "gelap");
  assert.equal(createTheme(storage).choice(), "gelap");
});

test("every choice round-trips", () => {
  for (const choice of THEME_CHOICES) {
    const storage = memoryStorage();
    createTheme(storage).set(choice);
    assert.equal(createTheme(storage).choice(), choice);
  }
});

test("stored values that are not exactly a choice fall back to the default", () => {
  for (const bad of ["", " ", "Gelap", "gelap ", " terang", "dark", "light", "0", "null", "[]", "__proto__", "constructor", "sistem\n"]) {
    assert.equal(createTheme(memoryStorage({ [THEME_KEY]: bad })).choice(), DEFAULT_THEME, `nilai "${bad}" harus diabaikan`);
  }
});

test("missing or refusing storage never throws and the choice still works in this session", () => {
  const withoutStorage = createTheme(null);
  withoutStorage.set("terang");
  assert.equal(withoutStorage.choice(), "terang");
  const broken = createTheme({
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); }
  });
  assert.equal(broken.choice(), DEFAULT_THEME);
  broken.set("gelap");
  assert.equal(broken.choice(), "gelap");
});

test("'sistem' follows the system; the other choices ignore it", () => {
  assert.equal(resolveTheme("sistem", true), "gelap");
  assert.equal(resolveTheme("sistem", false), "terang");
  assert.equal(resolveTheme("terang", true), "terang");
  assert.equal(resolveTheme("gelap", false), "gelap");
});

test("the hint says what the system currently is only for 'sistem'", () => {
  assert.match(themeHint("sistem", "gelap"), /gelap/);
  assert.match(themeHint("sistem", "terang"), /terang/);
  assert.doesNotMatch(themeHint("terang", "terang"), /sistem|ponsel Anda/);
  assert.notEqual(themeHint("terang", "terang"), themeHint("gelap", "gelap"));
});

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the three theme buttons are in the Pengaturan tab and app.ts finds them by the ids it uses", () => {
  const html = read("index.html");
  const view = html.slice(html.indexOf('id="view-pengaturan"'), html.indexOf('id="view-baca"'));
  const choices = [...view.matchAll(/data-theme-choice="([\w-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(choices, [...THEME_CHOICES]);
  assert.ok(view.includes('id="theme-hint"'));
  const app = read("src/app/app.ts");
  assert.ok(app.includes('"[data-theme-choice]"') && app.includes('"#theme-hint"'));
});

test("the small script in index.html uses the same storage key and the same rule as theme.ts", () => {
  const html = read("index.html");
  const script = html.slice(html.indexOf("<script>"), html.indexOf("</script>"));
  assert.ok(script.includes(`"${THEME_KEY}"`), "kunci di index.html berbeda dari THEME_KEY");
  // Jalankan skrip itu dengan storage dan matchMedia palsu: hasilnya harus sama dengan resolveTheme.
  const body = script.replace(/^<script>/, "");
  for (const choice of [...THEME_CHOICES, null]) {
    for (const systemDark of [true, false]) {
      const documentElement = { dataset: {} as Record<string, string> };
      new Function("localStorage", "matchMedia", "document", body)(
        { getItem: () => choice },
        () => ({ matches: systemDark }),
        { documentElement }
      );
      assert.equal(documentElement.dataset.theme, resolveTheme(choice ?? DEFAULT_THEME, systemDark), `pilihan ${choice}, sistem gelap ${systemDark}`);
    }
  }
});

test("theme-color: light matches the meta tag that already existed, dark matches the dark --bg", () => {
  assert.match(read("index.html"), new RegExp(`<meta name="theme-color" content="${THEME_COLORS.terang}"`));
  const css = read("src/ui/styles.css");
  const dark = css.slice(css.indexOf(':root[data-theme="gelap"] {'));
  assert.equal(dark.match(/--bg:\s*(#[0-9a-fA-F]{6});/)?.[1], THEME_COLORS.gelap);
});
