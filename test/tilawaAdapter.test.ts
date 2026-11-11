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

test("normalizes Zipformer word progress, keeping the cursor index and matched indices", () => {
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
    total_words: 7,
    matched_indices: [0, 1]
  });
});

test("keeps gaps in matched indices and does not alias the engine's array", () => {
  const matched = [0, 1, 3];
  const event: WorkerOutbound = {
    type: "word_progress",
    surah: 112,
    ayah: 1,
    word_index: 3,
    total_words: 4,
    matched_indices: matched
  };

  const normalized = toRecognitionEvent(event);

  assert.ok(normalized && normalized.type === "word_progress");
  assert.deepEqual(normalized.matched_indices, [0, 1, 3]);
  assert.notEqual(normalized.matched_indices, matched);
});

test("does not expose unrelated Zipformer events to the application", () => {
  const event: WorkerOutbound = { type: "raw_transcript", text: "...", confidence: 0.8 };

  assert.equal(toRecognitionEvent(event), null);
});
