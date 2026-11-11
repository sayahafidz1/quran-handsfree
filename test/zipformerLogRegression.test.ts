import test from "node:test";
import assert from "node:assert/strict";
import type { WorkerOutbound } from "@tilawa/core";
import { ReadingSession } from "../src/app/reading/ReadingSession.ts";
import { toRecognitionEvent } from "../src/recognition/tilawa/types.ts";
import { getReadingStatus } from "../src/ui/readingStatus.ts";
import { getWordHighlight } from "../src/ui/wordHighlight.ts";

/**
 * Replays a real Zipformer (@tilawa/core 0.4.0) capture of Al-Ikhlas 112:1-2.
 * Before the fix, the app read `word_index: 3` of 4 as "three words done", so
 * "Ahad" was never highlighted, the ayah never finished and the following
 * `verse_match` for 112:2 was reported as a mismatch.
 */
const verseMatch = (ayah: number, confidence: number): WorkerOutbound => ({
  type: "verse_match",
  surah: 112,
  ayah,
  verse_text: "",
  surah_name: "",
  confidence,
  surrounding_verses: []
} as unknown as WorkerOutbound);

const progress = (ayah: number, wordIndex: number, totalWords: number, matched: number[]): WorkerOutbound => ({
  type: "word_progress",
  surah: 112,
  ayah,
  word_index: wordIndex,
  total_words: totalWords,
  matched_indices: matched
});

const feed = (session: ReadingSession, message: WorkerOutbound): boolean => {
  const event = toRecognitionEvent(message);
  assert.ok(event, "event must reach the application");
  return session.handleEvent(event);
};

const ayah1Words = [0, 1, 2, 3].map((index) => ({ index, text: `word-${index}` }));

test("Al-Ikhlas 112:1 highlights Ahad and finishes the ayah", () => {
  const session = new ReadingSession();
  session.start();

  // chunk 70: word_progress arrives before verse_match, so there is no lock yet.
  assert.equal(feed(session, progress(1, 3, 4, [0, 1, 2, 3])), false);
  feed(session, verseMatch(1, 1));
  assert.equal(session.getState().state, "locked");

  // chunk 81
  assert.equal(feed(session, progress(1, 3, 4, [0, 1, 2, 3])), true);
  const finished = session.getState();

  assert.equal(finished.state, "expecting_next");
  assert.deepEqual(finished.expectedNextVerse, { surah: 112, ayah: 2 });
  assert.deepEqual(ayah1Words.map((word) => getWordHighlight(word, finished.wordProgress)), [
    "passed",
    "passed",
    "passed",
    "passed"
  ]);
});

test("Al-Ikhlas moves from 112:1 to 112:2 without a mismatch", () => {
  const session = new ReadingSession();
  session.start();
  feed(session, verseMatch(1, 1));
  feed(session, progress(1, 3, 4, [0, 1, 2, 3]));

  // chunk 103: the cursor has entered 112:2 but no word has a verdict yet.
  assert.equal(feed(session, progress(2, 0, 2, [])), true);
  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 112, ayah: 2 });
  assert.equal(
    [0, 1].map((index) => getWordHighlight({ index, text: "" }, session.getState().wordProgress)).join(),
    "current,upcoming"
  );

  // chunk 109: first word matched, then verse_match 112:2 with confidence 0.5.
  feed(session, progress(2, 0, 2, [0]));
  feed(session, verseMatch(2, 0.5));

  const snapshot = session.getState();
  assert.equal(snapshot.state, "tracking");
  assert.equal(getReadingStatus(snapshot).label, "Mengikuti bacaan");
  assert.deepEqual(snapshot.currentVerse, { surah: 112, ayah: 2 });
  assert.deepEqual(snapshot.expectedVerse, { surah: 112, ayah: 2 });
});

test("the same transition works when verse_match arrives before word_progress", () => {
  const session = new ReadingSession();
  session.start();
  feed(session, verseMatch(1, 1));
  feed(session, progress(1, 3, 4, [0, 1, 2, 3]));

  feed(session, verseMatch(2, 0.5));
  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 112, ayah: 2 });

  assert.equal(feed(session, progress(2, 1, 2, [0])), true);
  assert.equal(session.getState().state, "tracking");
});
