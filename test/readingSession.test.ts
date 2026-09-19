import test from "node:test";
import assert from "node:assert/strict";
import { ReadingSession } from "../src/app/reading/ReadingSession.ts";

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

test("ReadingSession follows discovery, lock, tracking, and next-ayah flow", () => {
  const session = new ReadingSession();
  session.start();
  assert.equal(session.getState().state, "discovering");

  session.handleEvent(verseMatch(36, 3));
  assert.equal(session.getState().state, "locked");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });

  session.handleEvent(wordProgress(36, 3, 4, 7));
  assert.equal(session.getState().state, "tracking");

  session.handleEvent(wordProgress(36, 3, 7, 7));
  assert.equal(session.getState().state, "expecting_next");
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 36, ayah: 4 });

  session.handleEvent(verseMatch(36, 4));
  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 4 });
});

test("ReadingSession discovers and locks a verse without an explicit start", () => {
  const session = new ReadingSession();

  session.handleEvent(verseMatch(36, 3));

  assert.equal(session.getState().state, "locked");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
  assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 3 });
  assert.equal(session.handleEvent(wordProgress(36, 3, 1, 7)), true);
  assert.equal(session.getState().state, "tracking");
  assert.equal(session.handleEvent(wordProgress(36, 10, 1, 8)), false);
});

test("ReadingSession preserves manual verse selection while locking the matching discovery", () => {
  const session = new ReadingSession();
  session.start({ surah: 36, ayah: 3 });

  session.handleEvent(verseMatch(36, 3));

  assert.equal(session.getState().state, "locked");
  assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 3 });
  assert.equal(session.handleEvent(wordProgress(36, 3, 2, 7)), true);
});

test("ReadingSession enters mismatch without advancing on an unexpected verse", () => {
  const session = new ReadingSession();
  session.start({ surah: 36, ayah: 3 });
  session.handleEvent(verseMatch(36, 10));

  assert.equal(session.getState().state, "mismatch");
  assert.equal(session.getState().currentVerse, null);
  assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 3 });
  assert.deepEqual(session.getState().detectedVerse, { surah: 36, ayah: 10 });

  session.handleEvent(verseMatch(36, 3));
  assert.equal(session.getState().state, "locked");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
});

test("ReadingSession keeps the current ayah when the expected next ayah mismatches", () => {
  const session = new ReadingSession();
  session.start({ surah: 36, ayah: 3 });
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(wordProgress(36, 3, 7, 7));
  session.handleEvent(verseMatch(36, 10));

  assert.equal(session.getState().state, "mismatch");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 36, ayah: 4 });
});

test("ReadingSession recovers after a repeated current ayah", () => {
  const session = new ReadingSession();
  session.start({ surah: 36, ayah: 3 });
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(wordProgress(36, 3, 7, 7));

  session.handleEvent(verseMatch(36, 3));
  assert.equal(session.getState().state, "mismatch");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
  assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 4 });

  session.handleEvent(verseMatch(36, 4));
  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 4 });
  assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 4 });
  assert.equal(session.getState().expectedNextVerse, null);
});

test("ReadingSession rejects skipped ayahs without losing the expected next ayah", () => {
  const session = new ReadingSession();
  session.start({ surah: 36, ayah: 3 });
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(wordProgress(36, 3, 7, 7));

  session.handleEvent(verseMatch(36, 5));
  assert.equal(session.getState().state, "mismatch");
  assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 4 });
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 36, ayah: 4 });

  session.handleEvent(verseMatch(36, 4));
  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 4 });
});

test("ReadingSession completes at the final ayah", () => {
  const session = new ReadingSession();
  session.start({ surah: 114, ayah: 6 });
  session.handleEvent(verseMatch(114, 6));
  session.handleEvent(wordProgress(114, 6, 6, 6));

  assert.equal(session.getState().state, "completed");
  assert.equal(session.getState().expectedNextVerse, null);
});

test("ReadingSession keeps completion terminal when resuming", () => {
  const session = new ReadingSession();
  session.start({ surah: 114, ayah: 6 });
  session.handleEvent(verseMatch(114, 6));
  session.handleEvent(wordProgress(114, 6, 6, 6));
  const completed = session.getState();

  session.resumeListening();

  assert.deepEqual(session.getState(), completed);
});

test("ReadingSession ignores recognition events after completion", () => {
  const session = new ReadingSession();
  session.start({ surah: 114, ayah: 6 });
  session.handleEvent(verseMatch(114, 6));
  session.handleEvent(wordProgress(114, 6, 6, 6));
  const completed = session.getState();

  session.handleEvent(verseMatch(1, 1));
  assert.deepEqual(session.getState(), completed);
  assert.equal(session.handleEvent(wordProgress(114, 6, 1, 6)), false);
  assert.deepEqual(session.getState(), completed);
});

test("ReadingSession expects the first ayah of the next surah", () => {
  const session = new ReadingSession();
  session.start({ surah: 1, ayah: 7 });
  session.handleEvent(verseMatch(1, 7));
  session.handleEvent(wordProgress(1, 7, 7, 7));

  assert.equal(session.getState().state, "expecting_next");
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 2, ayah: 1 });
});

test("ReadingSession rejects word progress from another verse", () => {
  const session = new ReadingSession();
  session.start();
  session.handleEvent(verseMatch(36, 3));

  assert.equal(session.handleWordProgress(wordProgress(36, 10, 1, 8)), false);
  assert.equal(session.getState().wordProgress, null);
  assert.equal(session.getState().state, "locked");
});

test("ReadingSession keeps the latest valid word progress for repeated events", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(36, 3));

  assert.equal(session.handleEvent(wordProgress(36, 3, 2, 7)), true);
  assert.deepEqual(session.getState().wordProgress, {
    surah: 36,
    ayah: 3,
    wordIndex: 2,
    totalWords: 7
  });

  test("ReadingSession controls preserve a resumable active position", () => {
    const session = new ReadingSession();
    session.start({ surah: 36, ayah: 3 });
    session.handleEvent(verseMatch(36, 3));
    session.stopListening();
    assert.equal(session.getState().state, "idle");
    assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });

    session.resumeListening();
    assert.equal(session.getState().state, "tracking");
    session.moveToNextVerse();
    assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 4 });
    session.moveToPreviousVerse();
    assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 3 });
  });
  assert.equal(session.handleEvent(wordProgress(36, 3, 2, 7)), true);
  assert.deepEqual(session.getState().wordProgress, {
    surah: 36,
    ayah: 3,
    wordIndex: 2,
    totalWords: 7
  });
});
