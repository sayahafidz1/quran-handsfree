import test from "node:test";
import assert from "node:assert/strict";
import { ReadingSession } from "../src/app/reading/ReadingSession.ts";
import { InactivityTimer, type TimerScheduler } from "../src/app/reading/InactivityTimer.ts";

const verseMatch = (surah: number, ayah: number, basmala?: boolean) => ({
  type: "verse_match" as const,
  surah,
  ayah,
  verse_text: "",
  confidence: 1,
  ...(basmala ? { basmala: true } : {})
});

const finished = (surah: number, ayah: number, totalWords: number) => ({
  type: "word_progress" as const,
  surah,
  ayah,
  word_index: totalWords - 1,
  total_words: totalWords,
  matched_indices: Array.from({ length: totalWords }, (_, index) => index)
});

const withRestarts = (session: ReadingSession) => {
  const counter = { count: 0 };
  session.onDiscoveryRestart(() => { counter.count += 1; });
  return counter;
};

test("after a surah is finished, the next detection may be anywhere (Al-Fatihah, then An-Naba 78:31)", () => {
  const session = new ReadingSession();
  const restarts = withRestarts(session);
  session.start();
  session.handleEvent(verseMatch(1, 7));
  session.handleEvent(finished(1, 7, 9));
  assert.equal(restarts.count, 1);
  assert.deepEqual(session.getState().expectedNextVerse, { surah: 2, ayah: 1 });

  session.handleEvent(verseMatch(78, 31));
  assert.equal(session.getState().state, "locked");
  assert.deepEqual(session.getState().currentVerse, { surah: 78, ayah: 31 });
  assert.equal(session.getState().expectedNextVerse, null);
  assert.equal(session.getState().wordProgress, null);
});

test("after a surah is finished, the expected next surah still locks as before", () => {
  const session = new ReadingSession();
  session.start();
  session.handleEvent(verseMatch(112, 4));
  session.handleEvent(finished(112, 4, 4));
  session.handleEvent(verseMatch(113, 1));
  assert.equal(session.getState().state, "tracking");
  assert.deepEqual(session.getState().currentVerse, { surah: 113, ayah: 1 });
});

test("inside a surah the rule stays strict: a different surah is a mismatch", () => {
  const session = new ReadingSession();
  session.start();
  session.handleEvent(verseMatch(2, 5));
  session.handleEvent(finished(2, 5, 8));
  session.handleEvent(verseMatch(3, 1));
  assert.equal(session.getState().state, "mismatch");
  assert.deepEqual(session.getState().currentVerse, { surah: 2, ayah: 5 });
});

test("a long pause opens one new search; the shown position is kept until a new lock", () => {
  const session = new ReadingSession();
  const restarts = withRestarts(session);
  session.start();
  session.handleEvent(verseMatch(78, 30));
  session.handleEvent(finished(78, 30, 6));
  session.handlePause();
  session.handlePause();
  assert.equal(restarts.count, 1);
  assert.deepEqual(session.getState().currentVerse, { surah: 78, ayah: 30 });

  session.handleEvent(verseMatch(1, 2));
  assert.equal(session.getState().state, "locked");
  assert.deepEqual(session.getState().currentVerse, { surah: 1, ayah: 2 });
  // The permission is used up: a following unrelated match is strict again.
  session.handleEvent(verseMatch(9, 9));
  assert.equal(session.getState().state, "mismatch");
});

test("a pause does nothing before the first lock, so a manual target stays strict", () => {
  const session = new ReadingSession();
  const restarts = withRestarts(session);
  session.start({ surah: 2, ayah: 255 });
  session.handlePause();
  assert.equal(restarts.count, 0);
  session.handleEvent(verseMatch(3, 1));
  assert.equal(session.getState().state, "mismatch");
});

test("a pause does nothing while idle or completed", () => {
  const session = new ReadingSession();
  const restarts = withRestarts(session);
  session.handlePause();
  assert.equal(restarts.count, 0);
});

test("a basmalah before ayah 1 of another surah lets the session move there", () => {
  const session = new ReadingSession();
  session.start();
  session.handleEvent(verseMatch(2, 5));
  session.handleEvent(finished(2, 5, 8));
  session.handleEvent(verseMatch(3, 1, true));
  assert.equal(session.getState().state, "locked");
  assert.deepEqual(session.getState().currentVerse, { surah: 3, ayah: 1 });
});

test("a basmalah flag on a later ayah does not open anything", () => {
  const session = new ReadingSession();
  session.start();
  session.handleEvent(verseMatch(2, 5));
  session.handleEvent(finished(2, 5, 8));
  session.handleEvent(verseMatch(3, 4, true));
  assert.equal(session.getState().state, "mismatch");
});

function fakeScheduler() {
  let next = 1;
  const pending = new Map<number, { callback: () => void; ms: number }>();
  const scheduler: TimerScheduler = {
    setTimeout(callback, ms) { const id = next++; pending.set(id, { callback, ms }); return id; },
    clearTimeout(handle) { pending.delete(handle as number); }
  };
  return { scheduler, pending, fireAll() { for (const [id, t] of [...pending]) { pending.delete(id); t.callback(); } } };
}

test("InactivityTimer fires once after touch, restarts on touch, and stops", () => {
  const fake = fakeScheduler();
  let fired = 0;
  const timer = new InactivityTimer(10_000, () => { fired += 1; }, fake.scheduler);

  timer.touch();
  timer.touch();
  assert.equal(fake.pending.size, 1);
  assert.equal([...fake.pending.values()][0].ms, 10_000);
  fake.fireAll();
  assert.equal(fired, 1);
  assert.equal(fake.pending.size, 0);

  timer.touch();
  timer.stop();
  fake.fireAll();
  assert.equal(fired, 1);
});
