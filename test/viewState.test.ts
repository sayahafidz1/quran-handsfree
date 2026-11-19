import test from "node:test";
import assert from "node:assert/strict";
import { createViewState, type AppView } from "../src/app/viewState.ts";

test("starts on Beranda", () => {
  assert.equal(createViewState().current(), "beranda");
});

test("tabs switch freely", () => {
  const views = createViewState();
  views.showTab("cari");
  assert.equal(views.current(), "cari");
  views.showTab("info");
  assert.equal(views.current(), "info");
});

test("the reading screen has no tabs: switching tab while reading is ignored", () => {
  const views = createViewState();
  views.openReader();
  assert.equal(views.current(), "baca");
  views.showTab("info");
  assert.equal(views.current(), "baca");
});

test("leaving the reading screen returns to the tab it was opened from", () => {
  const views = createViewState();
  views.showTab("cari");
  views.openReader();
  assert.equal(views.closeReader(), "cari");
  assert.equal(views.current(), "cari");
});

test("closing when not reading changes nothing", () => {
  const views = createViewState();
  views.showTab("info");
  assert.equal(views.closeReader(), "info");
  assert.equal(views.current(), "info");
});

test("listeners hear each change once and can unsubscribe", () => {
  const views = createViewState();
  const seen: AppView[] = [];
  const off = views.subscribe((view) => seen.push(view));
  views.showTab("cari");
  views.showTab("cari");
  views.openReader();
  views.openReader();
  views.closeReader();
  off();
  views.showTab("info");
  assert.deepEqual(seen, ["cari", "baca", "cari"]);
});
