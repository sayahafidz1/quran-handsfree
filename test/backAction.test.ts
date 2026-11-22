import test from "node:test";
import assert from "node:assert/strict";
import { decideBackAction, findCapacitorApp, hasCapacitor } from "../src/app/backAction.ts";

test("back on the reading screen leaves it", () => {
  assert.equal(decideBackAction("baca"), "leave-reader");
});

test("back on Cari or Info goes to Beranda", () => {
  assert.equal(decideBackAction("cari"), "show-beranda");
  assert.equal(decideBackAction("info"), "show-beranda");
});

test("back on Beranda exits the app", () => {
  assert.equal(decideBackAction("beranda"), "exit-app");
});

test("the Capacitor App plugin is found only when it is really there", () => {
  assert.equal(findCapacitorApp({}), null);
  assert.equal(findCapacitorApp(null), null);
  assert.equal(findCapacitorApp({ Capacitor: { Plugins: { App: { addListener() {} } } } }), null);
  assert.equal(findCapacitorApp({ Capacitor: {} }), null);
  const app = { addListener() {}, exitApp() {} };
  assert.equal(findCapacitorApp({ Capacitor: { Plugins: { App: app } } }), app);
});

test("falls back to Capacitor.registerPlugin('App') when Plugins.App is missing", () => {
  const app = { addListener() {}, exitApp() {} };
  const found = findCapacitorApp({ Capacitor: { Plugins: {}, registerPlugin: (name: string) => (name === "App" ? app : {}) } });
  assert.equal(found, app);
  assert.equal(findCapacitorApp({ Capacitor: { registerPlugin: () => { throw new Error("no plugin"); } } }), null);
});

test("hasCapacitor tells the APK from a normal browser", () => {
  assert.equal(hasCapacitor({}), false);
  assert.equal(hasCapacitor({ Capacitor: {} }), true);
});
