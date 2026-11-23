import test from "node:test";
import assert from "node:assert/strict";
import { getWordHighlight } from "../src/ui/wordHighlight.ts";

test("a skipped word is always marked skipped, even when the reader is past it or the ayah is finished", () => {
  const word = { index: 1 } as never;
  assert.equal(getWordHighlight(word, { surah: 1, ayah: 1, wordIndex: 3, totalWords: 5, matchedIndices: [0, 2, 3] }, [1]), "skipped");
  assert.equal(getWordHighlight(word, { surah: 1, ayah: 1, wordIndex: 4, totalWords: 5, matchedIndices: [0, 2, 3, 4] }, [1]), "skipped");
  assert.equal(getWordHighlight(word, null, [1]), "skipped");
});
