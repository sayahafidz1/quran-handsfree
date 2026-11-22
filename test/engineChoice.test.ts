import test from "node:test";
import assert from "node:assert/strict";
import { chooseEngine } from "../src/recognition/engineChoice.ts";

test("Tilawa 1.0 is the default", () => {
  assert.equal(chooseEngine(undefined), "v1");
  assert.equal(chooseEngine(""), "v1");
  assert.equal(chooseEngine("v1"), "v1");
});

test("v0 keeps the 0.4.0 fallback, tolerant of case and spaces", () => {
  assert.equal(chooseEngine("v0"), "v0");
  assert.equal(chooseEngine(" V0 "), "v0");
  assert.equal(chooseEngine("0.4.0"), "v0");
});

test("an unknown value falls back to the default, not to the old engine", () => {
  assert.equal(chooseEngine("zipformer"), "v1");
});
