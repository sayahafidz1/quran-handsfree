import test from "node:test";
import assert from "node:assert/strict";
import { V1PositionMapper, type V1PositionEvent } from "../src/recognition/tilawa/v1Mapper.ts";

const AYAHS: Record<string, string[]> = {
  "112:1": ["قُلْ", "هُوَ", "ٱللَّهُ", "أَحَدٌ"],
  "112:2": ["ٱللَّهُ", "ٱلصَّمَدُ"]
};
const lookup = (s: number, a: number) => AYAHS[`${s}:${a}`];

function position(
  state: V1PositionEvent["state"],
  at: [number, number, number],
  from: [number, number, number] = at,
  confidence = 0.9
): V1PositionEvent {
  const ref = ([surah, ayah, word]: [number, number, number]) => ({ surah, ayah, word });
  return { type: "position", state, observed: [{ word: ref(at), span: { start: ref(from), end: ref(at) }, confidence }] };
}

test("ignores events that are not locked positions", () => {
  const mapper = new V1PositionMapper(lookup);
  assert.deepEqual(mapper.map({ type: "checker" }), []);
  assert.deepEqual(mapper.map({ type: "capabilities" }), []);
  for (const state of ["acquiring", "ambiguous", "lost"] as const) {
    assert.deepEqual(mapper.map(position(state, [112, 1, 2])), []);
  }
  assert.deepEqual(mapper.map({ type: "position", state: "locked", observed: [] } as V1PositionEvent), []);
});

test("first locked position yields verse_match then zero-based word_progress", () => {
  const mapper = new V1PositionMapper(lookup);
  assert.deepEqual(mapper.map(position("locked", [112, 1, 2], [112, 1, 1])), [
    { type: "verse_match", surah: 112, ayah: 1, verse_text: AYAHS["112:1"].join(" "), confidence: 0.9 },
    { type: "word_progress", surah: 112, ayah: 1, word_index: 1, total_words: 4, matched_indices: [0, 1] }
  ]);
});

test("emits only changes: repeated position is silent, next word gives progress only", () => {
  const mapper = new V1PositionMapper(lookup);
  mapper.map(position("locked", [112, 1, 2], [112, 1, 1]));
  assert.deepEqual(mapper.map(position("locked", [112, 1, 2], [112, 1, 1])), []);
  assert.deepEqual(mapper.map(position("locked", [112, 1, 3], [112, 1, 1])), [
    { type: "word_progress", surah: 112, ayah: 1, word_index: 2, total_words: 4, matched_indices: [0, 1, 2] }
  ]);
});

test("last word of the ayah puts the last index in matched_indices", () => {
  const mapper = new V1PositionMapper(lookup);
  const out = mapper.map(position("locked", [112, 1, 4], [112, 1, 1]));
  const progress = out.find((e) => e.type === "word_progress");
  assert.ok(progress && progress.type === "word_progress");
  assert.deepEqual(progress.matched_indices, [0, 1, 2, 3]);
  assert.equal(progress.word_index, 3);
});

test("moving to the next ayah emits verse_match and covers only that ayah's words", () => {
  const mapper = new V1PositionMapper(lookup);
  mapper.map(position("locked", [112, 1, 4], [112, 1, 1]));
  assert.deepEqual(mapper.map(position("locked", [112, 2, 1], [112, 1, 3])), [
    { type: "verse_match", surah: 112, ayah: 2, verse_text: AYAHS["112:2"].join(" "), confidence: 0.9 },
    { type: "word_progress", surah: 112, ayah: 2, word_index: 0, total_words: 2, matched_indices: [0] }
  ]);
});

test("unknown ayah produces no event, and reset forgets the current ayah", () => {
  const mapper = new V1PositionMapper(lookup);
  assert.deepEqual(mapper.map(position("locked", [999, 1, 1])), []);
  mapper.map(position("locked", [112, 1, 1]));
  mapper.reset();
  const out = mapper.map(position("locked", [112, 1, 1]));
  assert.equal(out[0].type, "verse_match");
});
