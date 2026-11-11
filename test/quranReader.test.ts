import test from "node:test";
import assert from "node:assert/strict";
import { getWordHighlight } from "../src/ui/wordHighlight.ts";

const word = (index: number) => ({ index, text: `word-${index}` });
const highlights = (progress: Parameters<typeof getWordHighlight>[1], totalWords = 4) =>
  Array.from({ length: totalWords }, (_, index) => getWordHighlight(word(index), progress));

test("highlights the zero-based cursor word as current", () => {
  const progress = { surah: 36, ayah: 3, wordIndex: 2, totalWords: 4, matchedIndices: [0, 1] };

  assert.deepEqual(highlights(progress), ["passed", "passed", "current", "upcoming"]);
});

test("highlights the first word when the cursor starts the ayah", () => {
  const progress = { surah: 36, ayah: 3, wordIndex: 0, totalWords: 4, matchedIndices: [] };

  assert.deepEqual(highlights(progress), ["current", "upcoming", "upcoming", "upcoming"]);
});

test("marks the last word as passed once it is matched, even though the cursor stays on it", () => {
  const progress = { surah: 36, ayah: 3, wordIndex: 3, totalWords: 4, matchedIndices: [0, 1, 2, 3] };

  assert.deepEqual(highlights(progress), ["passed", "passed", "passed", "passed"]);
});

test("keeps the last word current while it has no verdict yet", () => {
  const progress = { surah: 36, ayah: 3, wordIndex: 3, totalWords: 4, matchedIndices: [0, 1, 2] };

  assert.deepEqual(highlights(progress), ["passed", "passed", "passed", "current"]);
});

test("treats matched words as passed and tolerates gaps in matched indices", () => {
  const progress = { surah: 36, ayah: 3, wordIndex: 2, totalWords: 5, matchedIndices: [0, 3] };

  assert.deepEqual(highlights(progress, 5), ["passed", "passed", "current", "passed", "upcoming"]);
});

test("does not highlight words without progress", () => {
  assert.equal(getWordHighlight(word(0), null), "upcoming");
});
