import test from "node:test";
import assert from "node:assert/strict";
import {
  BOOKMARKS_KEY,
  LAST_READ_KEY,
  MAX_BOOKMARKS,
  createBookmarkStore,
  type BookmarkStorage
} from "../src/app/bookmarks.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  let writes = 0;
  const storage: BookmarkStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      data.set(key, value);
    }
  };
  return { storage, data, writes: () => writes };
}

test("bookmarks are saved newest first and survive a new store on the same storage", () => {
  const { storage } = memoryStorage();
  const store = createBookmarkStore(storage);
  assert.equal(store.add({ surah: 2, ayah: 255 }), true);
  assert.equal(store.add({ surah: 36, ayah: 58 }), true);
  assert.deepEqual(createBookmarkStore(storage).list(), [
    { surah: 36, ayah: 58 },
    { surah: 2, ayah: 255 }
  ]);
});

test("the same verse is not saved twice and can be removed", () => {
  const store = createBookmarkStore(memoryStorage().storage);
  assert.equal(store.add({ surah: 18, ayah: 10 }), true);
  assert.equal(store.add({ surah: 18, ayah: 10 }), false);
  assert.equal(store.has({ surah: 18, ayah: 10 }), true);
  assert.equal(store.remove({ surah: 18, ayah: 10 }), true);
  assert.equal(store.remove({ surah: 18, ayah: 10 }), false);
  assert.deepEqual(store.list(), []);
});

test("invalid references are rejected", () => {
  const store = createBookmarkStore(memoryStorage().storage);
  assert.equal(store.add({ surah: 0, ayah: 1 }), false);
  assert.equal(store.add({ surah: 115, ayah: 1 }), false);
  assert.equal(store.add({ surah: 2, ayah: 0 }), false);
  assert.equal(store.add({ surah: 2.5, ayah: 1 }), false);
  assert.deepEqual(store.list(), []);
});

test("the list is capped so storage cannot grow without limit", () => {
  const store = createBookmarkStore(memoryStorage().storage);
  for (let ayah = 1; ayah <= MAX_BOOKMARKS; ayah += 1) assert.equal(store.add({ surah: 2, ayah }), true);
  assert.equal(store.add({ surah: 3, ayah: 1 }), false);
  assert.equal(store.list().length, MAX_BOOKMARKS);
});

test("last read is stored and only written again when the position changes", () => {
  const memory = memoryStorage();
  const store = createBookmarkStore(memory.storage);
  assert.equal(store.getLastRead(), null);
  store.setLastRead({ surah: 112, ayah: 1 });
  store.setLastRead({ surah: 112, ayah: 1 });
  assert.equal(memory.writes(), 1);
  store.setLastRead({ surah: 112, ayah: 2 });
  assert.deepEqual(createBookmarkStore(memory.storage).getLastRead(), { surah: 112, ayah: 2 });
  assert.equal(memory.writes(), 2);
});

test("last read and bookmarks are separate: reading never creates a bookmark", () => {
  const store = createBookmarkStore(memoryStorage().storage);
  store.setLastRead({ surah: 1, ayah: 3 });
  assert.deepEqual(store.list(), []);
});

test("broken or tampered data is treated as empty, good entries are kept", () => {
  const broken = createBookmarkStore(memoryStorage({
    [BOOKMARKS_KEY]: "{not json",
    [LAST_READ_KEY]: "[1,2]"
  }).storage);
  assert.deepEqual(broken.list(), []);
  assert.equal(broken.getLastRead(), null);

  const mixed = createBookmarkStore(memoryStorage({
    [BOOKMARKS_KEY]: JSON.stringify([{ surah: 2, ayah: 1 }, { surah: 999, ayah: 1 }, "x", { surah: 2, ayah: 1 }])
  }).storage);
  assert.deepEqual(mixed.list(), [{ surah: 2, ayah: 1 }]);
});

test("missing or refusing storage never throws", () => {
  for (const storage of [null, undefined]) {
    const store = createBookmarkStore(storage);
    assert.equal(store.add({ surah: 1, ayah: 1 }), false);
    store.setLastRead({ surah: 1, ayah: 1 });
    assert.deepEqual(store.list(), []);
    assert.equal(store.getLastRead(), null);
  }
  const refusing = createBookmarkStore({
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    }
  });
  assert.equal(refusing.add({ surah: 1, ayah: 1 }), false);
  assert.deepEqual(refusing.list(), []);
  refusing.setLastRead({ surah: 1, ayah: 1 });
});

test("toggleBookmark: saves, then removes, and reports a failed save", async () => {
  const { toggleBookmark } = await import("../src/app/bookmarks.ts");
  const data = new Map<string, string>();
  const store = createBookmarkStore({
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value)
  });
  assert.equal(toggleBookmark(store, { surah: 112, ayah: 2 }), "added");
  assert.equal(store.has({ surah: 112, ayah: 2 }), true);
  assert.equal(toggleBookmark(store, { surah: 112, ayah: 2 }), "removed");
  assert.equal(store.has({ surah: 112, ayah: 2 }), false);
  assert.equal(toggleBookmark(store, { surah: 999, ayah: 1 }), "failed");
});
