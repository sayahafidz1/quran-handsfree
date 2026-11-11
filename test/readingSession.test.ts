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

// `wordIndex` is Tilawa's zero-based cursor; by default every word before it is matched.
const wordProgress = (
  surah: number,
  ayah: number,
  wordIndex: number,
  totalWords: number,
  matchedIndices: number[] = Array.from({ length: wordIndex }, (_, index) => index)
) => ({
  type: "word_progress" as const,
  surah,
  ayah,
  word_index: wordIndex,
  total_words: totalWords,
  matched_indices: matchedIndices
});

// The reader finished the ayah: cursor on the last word and every word matched.
const finishedProgress = (surah: number, ayah: number, totalWords: number) =>
  wordProgress(surah, ayah, totalWords - 1, totalWords, Array.from({ length: totalWords }, (_, index) => index));

test("ReadingSession follows discovery, lock, tracking, and next-ayah flow", () => {
  const session = new ReadingSession();
  session.start();
  assert.equal(session.getState().state, "discovering");

  session.handleEvent(verseMatch(36, 3));
  assert.equal(session.getState().state, "locked");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });

  session.handleEvent(wordProgress(36, 3, 4, 7));
  assert.equal(session.getState().state, "tracking");

  session.handleEvent(finishedProgress(36, 3, 7));
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
  session.handleEvent(finishedProgress(36, 3, 7));
  session.handleEvent(verseMatch(36, 10));

  assert.equal(session.getState().state, "mismatch");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 36, ayah: 4 });
});

test("ReadingSession recovers after a repeated current ayah", () => {
  const session = new ReadingSession();
  session.start({ surah: 36, ayah: 3 });
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(finishedProgress(36, 3, 7));

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
  session.handleEvent(finishedProgress(36, 3, 7));

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
  session.handleEvent(finishedProgress(114, 6, 6));

  assert.equal(session.getState().state, "completed");
  assert.equal(session.getState().expectedNextVerse, null);
});

test("ReadingSession keeps completion terminal when resuming", () => {
  const session = new ReadingSession();
  session.start({ surah: 114, ayah: 6 });
  session.handleEvent(verseMatch(114, 6));
  session.handleEvent(finishedProgress(114, 6, 6));
  const completed = session.getState();

  session.resumeListening();

  assert.deepEqual(session.getState(), completed);
});

test("ReadingSession ignores recognition events after completion", () => {
  const session = new ReadingSession();
  session.start({ surah: 114, ayah: 6 });
  session.handleEvent(verseMatch(114, 6));
  session.handleEvent(finishedProgress(114, 6, 6));
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
  session.handleEvent(finishedProgress(1, 7, 7));

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
    totalWords: 7,
    matchedIndices: [0, 1]
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
    totalWords: 7,
    matchedIndices: [0, 1]
  });
});

test("ReadingSession does not advance to the next ayah before the current one is finished", () => {
  const session = new ReadingSession();
  session.start({ surah: 36, ayah: 3 });
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(wordProgress(36, 3, 3, 7));

  session.handleEvent(verseMatch(36, 4));

  assert.equal(session.getState().state, "mismatch");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
  assert.equal(session.getState().wordProgress?.wordIndex, 3);
  assert.equal(session.handleEvent(wordProgress(36, 4, 0, 8, [])), false);
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
});

test("ReadingSession blocks a long ayah from being cut short by the next ayah (Al-Bayyinah style)", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(98, 2));
  session.handleEvent(wordProgress(98, 2, 1, 6, [0, 1]));

  session.handleEvent(verseMatch(98, 3));
  assert.equal(session.getState().state, "mismatch");
  assert.equal(session.handleEvent(wordProgress(98, 3, 0, 4, [])), false);
  assert.deepEqual(session.getState().currentVerse, { surah: 98, ayah: 2 });

  // The reader goes back and finishes the ayah, which unlocks the next one.
  session.handleEvent(wordProgress(98, 2, 5, 6, [0, 1, 2, 3, 4, 5]));
  assert.equal(session.getState().state, "expecting_next");
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 98, ayah: 3 });

  assert.equal(session.handleEvent(wordProgress(98, 3, 0, 4, [])), true);
  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 98, ayah: 3 });
});

test("ReadingSession lets the reader re-read earlier words of the same ayah after a mismatch", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(98, 2));
  session.handleEvent(wordProgress(98, 2, 5, 6, [0, 1, 2, 3, 4]));
  session.handleEvent(verseMatch(98, 4));
  assert.equal(session.getState().state, "mismatch");

  assert.equal(session.handleEvent(wordProgress(98, 2, 2, 6, [0, 1])), true);

  assert.equal(session.getState().state, "tracking");
  assert.equal(session.getState().wordProgress?.wordIndex, 2);
});

test("ReadingSession follows word progress that moves into the next ayah", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(finishedProgress(36, 3, 7));

  assert.equal(session.handleEvent(wordProgress(36, 4, 1, 8)), true);

  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 4 });
  assert.deepEqual(session.getState().expectedVerse, { surah: 36, ayah: 4 });
  assert.equal(session.getState().expectedNextVerse, null);
  assert.equal(session.getState().wordProgress?.wordIndex, 1);
});

test("ReadingSession ignores word progress from a verse that is not next", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(36, 3));

  assert.equal(session.handleEvent(wordProgress(36, 5, 1, 8)), false);
  assert.equal(session.handleEvent(wordProgress(36, 2, 1, 8)), false);
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
});

test("ReadingSession does not treat the cursor reaching totalWords - 1 as a finished ayah", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(36, 3));

  session.handleEvent(wordProgress(36, 3, 6, 7, [0, 1, 2, 3, 4, 5]));

  assert.equal(session.getState().state, "tracking");
  assert.equal(session.getState().expectedNextVerse, null);
});

test("ReadingSession finishes an ayah when the last word is matched, even with gaps", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(36, 3));

  session.handleEvent(wordProgress(36, 3, 6, 7, [0, 1, 3, 6]));

  assert.equal(session.getState().state, "expecting_next");
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 36, ayah: 4 });
});

test("ReadingSession keeps a finished ayah completed while its words are repeated", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(finishedProgress(36, 3, 7));
  assert.equal(session.getState().state, "expecting_next");

  // matched_indices is a snapshot: the last word dropped out while repeating.
  session.handleEvent(wordProgress(36, 3, 1, 7, [0]));

  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 36, ayah: 4 });
  assert.equal(session.getState().wordProgress?.wordIndex, 1);

  // Completion stuck, so the next ayah is still accepted.
  assert.equal(session.handleEvent(wordProgress(36, 4, 0, 8, [])), true);
  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 4 });
  assert.equal(session.getState().expectedNextVerse, null);
});

test("ReadingSession still rejects a skipped ayah after the current one finished", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(finishedProgress(36, 3, 7));

  assert.equal(session.handleEvent(wordProgress(36, 5, 0, 12, [])), false);
  session.handleEvent(verseMatch(36, 5));

  assert.equal(session.getState().state, "mismatch");
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 36, ayah: 4 });
  assert.deepEqual(session.getState().currentVerse, { surah: 36, ayah: 3 });
});

test("ReadingSession keeps tracking when the tracked ayah is matched again", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(wordProgress(36, 3, 2, 7));

  session.handleEvent(verseMatch(36, 3));

  assert.equal(session.getState().state, "tracking");
});

test("ReadingSession normalizes matched indices", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(36, 3));

  session.handleEvent(wordProgress(36, 3, 2, 7, [3, 0, 3, 1, -1, 9, 1.5]));

  assert.deepEqual(session.getState().wordProgress?.matchedIndices, [0, 1, 3]);
});

const withRestartCounter = (session: ReadingSession) => {
  const counter = { count: 0 };
  session.onDiscoveryRestart(() => { counter.count += 1; });
  return counter;
};

test("ReadingSession requests one discovery restart when the last ayah of a surah is finished", () => {
  const session = new ReadingSession();
  const restarts = withRestartCounter(session);
  session.handleEvent(verseMatch(112, 4));

  session.handleEvent(wordProgress(112, 4, 3, 5, [0, 1, 2]));
  assert.equal(restarts.count, 0);

  session.handleEvent(finishedProgress(112, 4, 5));
  assert.equal(restarts.count, 1);
  assert.equal(session.getState().state, "expecting_next");
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 113, ayah: 1 });

  // Repeated snapshots of the same finished ayah must not restart again.
  session.handleEvent(finishedProgress(112, 4, 5));
  session.handleEvent(wordProgress(112, 4, 1, 5, [0]));
  session.handleEvent(finishedProgress(112, 4, 5));
  assert.equal(restarts.count, 1);
});

test("ReadingSession does not restart discovery at the end of an ayah inside a surah", () => {
  const session = new ReadingSession();
  const restarts = withRestartCounter(session);
  session.handleEvent(verseMatch(112, 1));

  session.handleEvent(finishedProgress(112, 1, 4));

  assert.equal(session.getState().state, "expecting_next");
  assert.equal(restarts.count, 0);
});

test("ReadingSession does not restart discovery after the final ayah of the Quran", () => {
  const session = new ReadingSession();
  const restarts = withRestartCounter(session);
  session.handleEvent(verseMatch(114, 6));

  session.handleEvent(finishedProgress(114, 6, 4));

  assert.equal(session.getState().state, "completed");
  assert.equal(restarts.count, 0);
});

test("ReadingSession continues into the next surah once discovery finds its first ayah", () => {
  const session = new ReadingSession();
  session.handleEvent(verseMatch(112, 4));
  session.handleEvent(finishedProgress(112, 4, 5));

  session.handleEvent(verseMatch(113, 1));

  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 113, ayah: 1 });
  assert.equal(session.getState().expectedNextVerse, null);
});

test("ReadingSession treats a basmalah before the next surah as a restart request, not a mismatch", () => {
  const session = new ReadingSession();
  const restarts = withRestartCounter(session);
  session.handleEvent(verseMatch(112, 4));
  session.handleEvent(finishedProgress(112, 4, 5));
  const afterFinish = restarts.count;

  session.handleEvent(verseMatch(1, 1));

  assert.equal(restarts.count, afterFinish + 1);
  assert.equal(session.getState().state, "expecting_next");
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 113, ayah: 1 });
  assert.deepEqual(session.getState().currentVerse, { surah: 112, ayah: 4 });
  assert.notDeepEqual(session.getState().detectedVerse, { surah: 1, ayah: 1 });

  session.handleEvent(verseMatch(113, 1));
  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 113, ayah: 1 });
});

test("ReadingSession only tolerates the basmalah when the next ayah starts another surah", () => {
  const session = new ReadingSession();
  const restarts = withRestartCounter(session);
  session.handleEvent(verseMatch(36, 3));
  session.handleEvent(finishedProgress(36, 3, 7));

  session.handleEvent(verseMatch(1, 1));

  assert.equal(session.getState().state, "mismatch");
  assert.equal(restarts.count, 0);
});

test("ReadingSession discovery restart listeners can be removed", () => {
  const session = new ReadingSession();
  let calls = 0;
  const unsubscribe = session.onDiscoveryRestart(() => { calls += 1; });
  unsubscribe();
  session.handleEvent(verseMatch(112, 4));

  session.handleEvent(finishedProgress(112, 4, 5));

  assert.equal(calls, 0);
});
