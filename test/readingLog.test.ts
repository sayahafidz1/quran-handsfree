import test from "node:test";
import assert from "node:assert/strict";
import { createReadingLog, describeRecognitionEvent, describeSessionChange } from "../src/app/readingLog.ts";
import type { RecognitionEvent } from "../src/recognition/types.ts";

test("keeps only the newest entries and prints seconds relative to the first kept entry", () => {
  const log = createReadingLog(3);
  [1000, 2500, 4000, 9000].forEach((t, i) => log.add(t, `e${i}`));
  assert.equal(log.size(), 3);
  assert.equal(log.toText(), "+0.0s e1\n+1.5s e2\n+6.5s e3");
});

test("header comes first and clear empties the log", () => {
  const log = createReadingLog();
  log.add(5, "a");
  assert.equal(log.toText("HEAD"), "HEAD\n+0.0s a");
  log.clear();
  assert.equal(log.size(), 0);
  assert.equal(log.toText(), "");
});

test("describes verse matches and word progress with the verdict of the session", () => {
  const match = { type: "verse_match", surah: 11, ayah: 12, verse_text: "", confidence: 0.874, basmala: true } as RecognitionEvent;
  assert.equal(describeRecognitionEvent(match), "verse_match 11:12 keyakinan=87% basmalah");
  const progress = {
    type: "word_progress", surah: 11, ayah: 12, word_index: 4, total_words: 10, matched_indices: [0, 1, 2, 3, 4]
  } as RecognitionEvent;
  assert.equal(
    describeRecognitionEvent(progress, true),
    "word_progress 11:12 kursor=kata 5/10 cocok=[0,1,2,3,4] diterima"
  );
  assert.match(describeRecognitionEvent(progress, false)!, /diabaikan$/);
  assert.equal(describeRecognitionEvent({ type: "ready" } as RecognitionEvent), null);
});

test("describes a session change only when the state or the active verse changed", () => {
  const tracking = { state: "tracking", currentVerse: { surah: 11, ayah: 12 }, expectedNextVerse: null } as const;
  const waiting = { state: "expecting_next", currentVerse: { surah: 11, ayah: 12 }, expectedNextVerse: { surah: 11, ayah: 13 } } as const;
  assert.equal(describeSessionChange(tracking, tracking), null);
  assert.equal(
    describeSessionChange(tracking, waiting),
    "sesi tracking -> expecting_next aktif=11:12 berikutnya=11:13"
  );
  assert.equal(describeSessionChange(null, tracking), "sesi - -> tracking aktif=11:12 berikutnya=-");
});
