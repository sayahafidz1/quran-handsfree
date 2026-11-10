import test from "node:test";
import assert from "node:assert/strict";
import { getTranscriptDelta, summarizeAudioChunk } from "../src/recognition/tilawa/diagnostics.ts";

test("summarizes each audio chunk independently", () => {
  assert.deepEqual(summarizeAudioChunk(new Float32Array([0.5, -0.5])), {
    samples: 2,
    rms: 0.5,
    peak: 0.5
  });
});

test("returns only newly appended transcript text", () => {
  assert.deepEqual(getTranscriptDelta("one two", "one two three"), {
    text: " three",
    revised: false
  });
});

test("marks transcript revisions while returning only the changed suffix", () => {
  assert.deepEqual(getTranscriptDelta("one two", "one too"), {
    text: "oo",
    revised: true
  });
});
