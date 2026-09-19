import test from "node:test";
import assert from "node:assert/strict";
import { ReadingSession, type ReadingSessionSnapshot } from "../src/app/reading/ReadingSession.ts";
import { getReadingStatus } from "../src/ui/readingStatus.ts";
import { getWordHighlight } from "../src/ui/wordHighlight.ts";

const verseMatch = (surah: number, ayah: number) => ({
  type: "verse_match" as const,
  surah,
  ayah,
  verse_text: "",
  confidence: 1
});

const wordProgress = (surah: number, ayah: number, wordIndex: number, totalWords: number) => ({
  type: "word_progress" as const,
  surah,
  ayah,
  word_index: wordIndex,
  total_words: totalWords
});

function finishVerse(session: ReadingSession, surah: number, ayah: number, totalWords = 3): void {
  session.handleEvent(verseMatch(surah, ayah));
  session.handleEvent(wordProgress(surah, ayah, totalWords, totalWords));
}

test("direct discovery follows discovering -> locked -> tracking", () => {
  const session = new ReadingSession();
  const states: ReadingSessionSnapshot["state"][] = [];
  session.subscribe((snapshot) => states.push(snapshot.state));

  session.start();
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(wordProgress(36, 3, 1, 3));

  assert.deepEqual(states.slice(-3), ["discovering", "locked", "tracking"]);
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
});

test("manual selection locks only after the selected verse is recognized", () => {
  const session = new ReadingSession();
  session.start({ surah: 36, ayah: 3 });
  session.handleEvent(verseMatch(36, 10));

  assert.equal(session.getState().state, "mismatch");
  assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 3 });

  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(wordProgress(36, 3, 1, 3));

  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
});

test("mismatch recovery preserves the target and accepts the expected next verse", () => {
  const session = new ReadingSession();
  session.start({ surah: 36, ayah: 3 });
  finishVerse(session, 36, 3);

  session.handleEvent(verseMatch(36, 10));
  assert.equal(session.getState().state, "mismatch");
  assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 4 });

  session.handleEvent(verseMatch(36, 4));
  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 4 });
});

test("repeat and skip never advance the expected next ayah", () => {
  const session = new ReadingSession();
  session.start({ surah: 36, ayah: 3 });
  finishVerse(session, 36, 3);

  session.handleEvent(verseMatch(36, 3));
  assert.equal(session.getState().state, "mismatch");
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 36, ayah: 4 });

  session.handleEvent(verseMatch(36, 5));
  assert.equal(session.getState().state, "mismatch");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
  assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 4 });
});

test("the expected next ayah advances across a surah boundary", () => {
  const session = new ReadingSession();
  session.start({ surah: 1, ayah: 7 });
  finishVerse(session, 1, 7);

  assert.equal(session.getState().state, "expecting_next");
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 2, ayah: 1 });

  session.handleEvent(verseMatch(2, 1));
  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 2, ayah: 1 });
});

test("the final Quran verse completes the session", () => {
  const session = new ReadingSession();
  session.start({ surah: 114, ayah: 6 });
  finishVerse(session, 114, 6);

  assert.equal(session.getState().state, "completed");
  assert.equal(session.getState().expectedNextVerse, null);
});

test("UI projections follow the session target and word progress", () => {
  const session = new ReadingSession();
  const snapshots: ReadingSessionSnapshot[] = [];
  session.subscribe((snapshot) => snapshots.push(snapshot));
  session.start({ surah: 36, ayah: 3 });
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(wordProgress(36, 3, 2, 4));

  const snapshot = snapshots.at(-1)!;
  assert.deepEqual(snapshot.currentVerse, { surah: 36, ayah: 3 });
  assert.equal(getReadingStatus(snapshot).label, "Mengikuti bacaan");

  const words = [0, 1, 2, 3].map((index) => ({ index, text: `word-${index}` }));
  assert.deepEqual(words.map((word) => getWordHighlight(word, snapshot.wordProgress)), [
    "passed",
    "current",
    "upcoming",
    "upcoming"
  ]);

  session.handleEvent(verseMatch(36, 10));
  const mismatch = session.getState();
  assert.equal(getReadingStatus(mismatch).label, "Ayat tidak sesuai");
  assert.deepEqual(mismatch.currentVerse, { surah: 36, ayah: 3 });
});
