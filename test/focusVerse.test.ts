import test from "node:test";
import assert from "node:assert/strict";
import { getFocusVerse, getLastReadVerse } from "../src/app/focusVerse.ts";
import { ReadingSession } from "../src/app/reading/ReadingSession.ts";
import type { RecognitionEvent } from "../src/recognition/types.ts";

function verseMatch(surah: number, ayah: number): RecognitionEvent {
  return { type: "verse_match", surah, ayah, verse_text: "", confidence: 1 } as RecognitionEvent;
}
function progress(surah: number, ayah: number, total: number, upTo: number): RecognitionEvent {
  return {
    type: "word_progress", surah, ayah, word_index: Math.min(upTo, total - 1), total_words: total,
    matched_indices: Array.from({ length: upTo + 1 }, (_, i) => i)
  } as RecognitionEvent;
}

test("while an ayah is being read, focus and last read are that ayah", () => {
  const session = new ReadingSession();
  session.start();
  session.handleEvent(verseMatch(11, 12));
  session.handleEvent(progress(11, 12, 10, 4));
  const snapshot = session.getState();
  assert.equal(snapshot.state, "tracking");
  assert.deepEqual(getFocusVerse(snapshot), { verse: { surah: 11, ayah: 12 }, waiting: false });
  assert.deepEqual(getLastReadVerse(snapshot), { surah: 11, ayah: 12 });
});

test("after a full ayah the focus and the last read move on to the next ayah", () => {
  const session = new ReadingSession();
  session.start();
  session.handleEvent(verseMatch(11, 12));
  session.handleEvent(progress(11, 12, 10, 9));
  const snapshot = session.getState();
  assert.equal(snapshot.state, "expecting_next");
  assert.deepEqual(getFocusVerse(snapshot), { verse: { surah: 11, ayah: 13 }, waiting: true });
  assert.deepEqual(getLastReadVerse(snapshot), { surah: 11, ayah: 13 });
});

test("an ayah read only partly never moves the last read forward", () => {
  const session = new ReadingSession();
  session.start();
  session.handleEvent(verseMatch(11, 12));
  session.handleEvent(progress(11, 12, 10, 8));
  assert.deepEqual(getLastReadVerse(session.getState()), { surah: 11, ayah: 12 });
});

test("a target that was opened but not yet detected is focused but not remembered as read", () => {
  const session = new ReadingSession();
  session.start({ surah: 36, ayah: 58 });
  const snapshot = session.getState();
  assert.deepEqual(getFocusVerse(snapshot), { verse: { surah: 36, ayah: 58 }, waiting: false });
  assert.equal(getLastReadVerse(snapshot), null);
});

test("at the end of a surah the focus is ayah 1 of the next surah; at the end of the Quran nothing moves", () => {
  const surahEnd = new ReadingSession();
  surahEnd.start();
  surahEnd.handleEvent(verseMatch(112, 4));
  surahEnd.handleEvent(progress(112, 4, 5, 4));
  assert.deepEqual(getLastReadVerse(surahEnd.getState()), { surah: 113, ayah: 1 });

  const quranEnd = new ReadingSession();
  quranEnd.start();
  quranEnd.handleEvent(verseMatch(114, 6));
  quranEnd.handleEvent(progress(114, 6, 3, 2));
  const snapshot = quranEnd.getState();
  assert.equal(snapshot.state, "completed");
  assert.deepEqual(getLastReadVerse(snapshot), { surah: 114, ayah: 6 });
});
