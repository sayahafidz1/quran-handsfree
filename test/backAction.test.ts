import test from "node:test";
import assert from "node:assert/strict";
import { decideBackAction, findCapacitorApp } from "../src/app/backAction.ts";

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
  const app = { addListener() {}, exitApp() {} };
  assert.equal(findCapacitorApp({ Capacitor: { Plugins: { App: app } } }), app);
});
