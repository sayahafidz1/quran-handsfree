import test from "node:test";
import assert from "node:assert/strict";
import { createModelReadyFlag } from "../src/app/modelReadyFlag.ts";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

test("not ready until marked, then remembered", () => {
  const storage = memoryStorage();
  const flag = createModelReadyFlag(storage);
  assert.equal(flag.wasReady(), false);
  flag.markReady();
  assert.equal(flag.wasReady(), true);
  assert.equal(createModelReadyFlag(storage).wasReady(), true);
});

test("missing or refusing storage never throws", () => {
  assert.equal(createModelReadyFlag(null).wasReady(), false);
  createModelReadyFlag(null).markReady();
  const broken = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); }
  };
  const flag = createModelReadyFlag(broken);
  assert.equal(flag.wasReady(), false);
  flag.markReady();
});
