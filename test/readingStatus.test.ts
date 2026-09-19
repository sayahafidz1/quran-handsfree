import test from "node:test";
import assert from "node:assert/strict";
import { getReadingStatus } from "../src/ui/readingStatus.ts";
import type { ReadingSessionSnapshot } from "../src/app/reading/ReadingSession.ts";

const snapshot = (state: ReadingSessionSnapshot["state"]): ReadingSessionSnapshot => ({
  state,
  currentVerse: null,
  expectedVerse: null,
  detectedVerse: null,
  expectedNextVerse: null,
  wordProgress: null
});

test("provides clear presentation text for every reading state", () => {
  for (const state of ["idle", "discovering", "locked", "tracking", "expecting_next", "completed"] as const) {
    const status = getReadingStatus(snapshot(state));
    assert.notEqual(status.label, "");
    assert.notEqual(status.message, "");
  }
});

test("explains mismatch recovery without changing session state", () => {
  const status = getReadingStatus({
    ...snapshot("mismatch"),
    expectedVerse: { surah: 36, ayah: 4 },
    detectedVerse: { surah: 36, ayah: 3 }
  });

  assert.equal(status.label, "Ayat tidak sesuai");
  assert.match(status.message, /Menunggu ayat 36:4/);
  assert.match(status.message, /Terdeteksi 36:3/);
  assert.match(status.message, /tetap dipertahankan/);
});
