import test from "node:test";
import assert from "node:assert/strict";
import { toRecognitionEvent } from "../src/recognition/tilawa/types.ts";
import type { WorkerOutbound } from "@tilawa/core";

test("normalizes Zipformer verse matches to the application contract", () => {
  const event: WorkerOutbound = {
    type: "verse_match",
    surah: 36,
    ayah: 3,
    verse_text: "وَآيَةٌ لَهُمُ",
    surah_name: "Ya-Sin",
    confidence: 0.92,
    surrounding_verses: [{ surah: 36, ayah: 2, text: "...", is_current: false }]
  };

  assert.deepEqual(toRecognitionEvent(event), {
    type: "verse_match",
    surah: 36,
    ayah: 3,
    verse_text: "وَآيَةٌ لَهُمُ",
    confidence: 0.92
  });
});

test("normalizes Zipformer word progress without changing its one-based index", () => {
  const event: WorkerOutbound = {
    type: "word_progress",
    surah: 36,
    ayah: 3,
    word_index: 2,
    total_words: 7,
    matched_indices: [0, 1]
  };

  assert.deepEqual(toRecognitionEvent(event), {
    type: "word_progress",
    surah: 36,
    ayah: 3,
    word_index: 2,
    total_words: 7
  });
});

test("does not expose unrelated Zipformer events to the application", () => {
  const event: WorkerOutbound = { type: "raw_transcript", text: "...", confidence: 0.8 };

  assert.equal(toRecognitionEvent(event), null);
});
