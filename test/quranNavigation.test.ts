import test from "node:test";
import assert from "node:assert/strict";
import { getNextVerse } from "../src/quran/index.ts";

test("getNextVerse advances within a surah", () => {
  assert.deepEqual(getNextVerse({ surah: 36, ayah: 3 }), { surah: 36, ayah: 4 });
});

test("getNextVerse starts the next surah at its boundary", () => {
  assert.deepEqual(getNextVerse({ surah: 1, ayah: 7 }), { surah: 2, ayah: 1 });
});

test("getNextVerse returns null after the final Quran verse", () => {
  assert.equal(getNextVerse({ surah: 114, ayah: 6 }), null);
});
