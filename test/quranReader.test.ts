import test from "node:test";
import assert from "node:assert/strict";
import { getWordHighlight } from "../src/ui/wordHighlight.ts";

const word = (index: number) => ({ index, text: `word-${index}` });

test("maps one-based recognition progress to stable zero-based Quran words", () => {
  const progress = { surah: 36, ayah: 3, wordIndex: 2, totalWords: 4 };

  assert.equal(getWordHighlight(word(0), progress), "passed");
  assert.equal(getWordHighlight(word(1), progress), "current");
  assert.equal(getWordHighlight(word(2), progress), "upcoming");
  assert.equal(getWordHighlight(word(3), progress), "upcoming");
});

test("marks every word passed after the verse reaches its final word", () => {
  const progress = { surah: 36, ayah: 3, wordIndex: 4, totalWords: 4 };

  assert.deepEqual([0, 1, 2, 3].map((index) => getWordHighlight(word(index), progress)), [
    "passed",
    "passed",
    "passed",
    "passed"
  ]);
});

test("does not highlight words without progress", () => {
  assert.equal(getWordHighlight(word(0), null), "upcoming");
});
