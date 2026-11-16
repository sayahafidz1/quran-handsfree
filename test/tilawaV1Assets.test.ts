import test from "node:test";
import assert from "node:assert/strict";
import {
  createMemoryStorage,
  localAssetBase,
  parseAssetMode,
  parseProviders,
  resolveTier
} from "../src/recognition/tilawa/v1Assets.ts";

test("asset mode is remote unless explicitly local", () => {
  assert.equal(parseAssetMode(undefined), "remote");
  assert.equal(parseAssetMode(""), "remote");
  assert.equal(parseAssetMode("LOCAL"), "remote");
  assert.equal(parseAssetMode("remote"), "remote");
  assert.equal(parseAssetMode("local"), "local");
});

test("tier: explicit full/lite wins; otherwise local means full and remote means auto", () => {
  assert.equal(resolveTier("local", undefined), "full");
  assert.equal(resolveTier("local", "auto"), "full");
  assert.equal(resolveTier("remote", undefined), "auto");
  assert.equal(resolveTier("remote", "auto"), "auto");
  assert.equal(resolveTier("local", "lite"), "lite");
  assert.equal(resolveTier("remote", "full"), "full");
});

test("providers keep only known values in order, or fall back to the SDK default", () => {
  assert.equal(parseProviders(undefined), undefined);
  assert.equal(parseProviders("cuda"), undefined);
  assert.deepEqual(parseProviders("wasm"), ["wasm"]);
  assert.deepEqual(parseProviders(" webgpu , wasm "), ["webgpu", "wasm"]);
  assert.deepEqual(parseProviders("webgpu,cuda"), ["webgpu"]);
});

test("local asset base is absolute, ends with a slash, and respects the Vite base", () => {
  assert.equal(localAssetBase("https://app.test", "/"), "https://app.test/tilawa-v1/");
  assert.equal(localAssetBase("http://localhost:5173", "/app/"), "http://localhost:5173/app/tilawa-v1/");
  assert.equal(localAssetBase("https://app.test", "app"), "https://app.test/app/tilawa-v1/");
});

test("memory storage stores, lists, replaces and deletes bytes", async () => {
  const storage = createMemoryStorage();
  assert.equal(await storage.get("a"), null);
  await storage.put("a", new Uint8Array([1, 2]));
  await storage.put("b", new Uint8Array([3]));
  assert.deepEqual([...(await storage.get("a")) ?? []], [1, 2]);
  assert.deepEqual((await storage.keys()).sort(), ["a", "b"]);
  await storage.put("a", new Uint8Array([9]));
  assert.deepEqual([...(await storage.get("a")) ?? []], [9]);
  await storage.delete("a");
  assert.equal(await storage.get("a"), null);
  assert.deepEqual(await storage.keys(), ["b"]);
});
