import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Runs public/sw.js against a small fake of the service worker environment (caches, fetch, events).
const swSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const ORIGIN = "https://app.test";

function createCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (request: Request | string, ignoreSearch = false) => {
    const url = new URL(typeof request === "string" ? request : request.url, ORIGIN);
    return ignoreSearch ? url.origin + url.pathname : url.href;
  };
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      put: async (request: Request | string, response: Response) => void store.set(keyOf(request), response),
      addAll: async (urls: string[]) => {
        for (const url of urls) store.set(keyOf(url), new Response("shell:" + url));
      }
    };
  };
  return {
    stores,
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: Request | string, options: { ignoreSearch?: boolean } = {}) => {
      const key = keyOf(request, options.ignoreSearch);
      for (const store of stores.values()) {
        for (const [storedKey, response] of store) {
          const comparable = options.ignoreSearch ? storedKey.split("?")[0] : storedKey;
          if (comparable === key) return response.clone();
        }
      }
      return undefined;
    }
  };
}

type Handler = (event: any) => void;

function createWorker(fetchImpl: (request: Request) => Promise<Response>) {
  const handlers = new Map<string, Handler>();
  const caches = createCaches();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: () => {},
    clients: { claim: async () => {} }
  };
  vm.runInNewContext(swSource, { self, caches, fetch: fetchImpl, URL, Response, Promise });

  async function fire(type: string, event: any) {
    let pending: Promise<unknown> | undefined;
    const fullEvent = { ...event, waitUntil: (p: Promise<unknown>) => (pending = p), respondWith: (p: Promise<unknown>) => (pending = p) };
    handlers.get(type)!(fullEvent);
    return { handled: pending !== undefined, result: pending ? await pending : undefined };
  }
  const request = (path: string, mode = "no-cors") =>
    ({ url: ORIGIN + path, method: "GET", mode }) as unknown as Request;
  return { caches, fire, request };
}

const html = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/html" } });
const css = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/css" } });

test("a page is fetched from the network first, so a new deploy shows up at once", async () => {
  let version = "v1";
  const sw = createWorker(async () => html("index " + version));
  await sw.fire("install", {});
  const first = await sw.fire("fetch", { request: sw.request("/", "navigate") });
  assert.equal(await (first.result as Response).text(), "index v1");
  version = "v2";
  const second = await sw.fire("fetch", { request: sw.request("/", "navigate") });
  assert.equal(await (second.result as Response).text(), "index v2");
});

test("offline, a page falls back to the cached copy", async () => {
  let online = true;
  const sw = createWorker(async () => {
    if (!online) throw new TypeError("offline");
    return html("index online");
  });
  await sw.fire("install", {});
  await sw.fire("fetch", { request: sw.request("/", "navigate") });
  online = false;
  const offline = await sw.fire("fetch", { request: sw.request("/", "navigate") });
  assert.equal(await (offline.result as Response).text(), "index online");
  const other = await sw.fire("fetch", { request: sw.request("/surah/2", "navigate") });
  assert.match(await (other.result as Response).text(), /shell:\/index\.html|index online/);
});

test("an HTML answer to an asset request (host fallback for a deleted file) is not cached", async () => {
  let calls = 0;
  const sw = createWorker(async () => {
    calls += 1;
    return html("fallback index");
  });
  await sw.fire("fetch", { request: sw.request("/assets/old-1234.css") });
  await sw.fire("fetch", { request: sw.request("/assets/old-1234.css") });
  assert.equal(calls, 2);
  assert.equal(await sw.caches.match("/assets/old-1234.css"), undefined);
});

test("a real asset is cached and then served from the cache", async () => {
  let calls = 0;
  const sw = createWorker(async () => {
    calls += 1;
    return css("body{}");
  });
  await sw.fire("fetch", { request: sw.request("/assets/app-5678.css") });
  const again = await sw.fire("fetch", { request: sw.request("/assets/app-5678.css") });
  assert.equal(calls, 1);
  assert.equal(await (again.result as Response).text(), "body{}");
});

test("activating removes old app caches but keeps other caches (model files, preferences)", async () => {
  const sw = createWorker(async () => css(""));
  await sw.caches.open("quran-handsfree-v3");
  await sw.caches.open("tilawa-v1-prefs");
  await sw.caches.open("some-model-cache");
  await sw.fire("install", {});
  await sw.fire("activate", {});
  const names = await sw.caches.keys();
  assert.ok(!names.includes("quran-handsfree-v3"));
  assert.ok(names.includes("quran-handsfree-v6"));
  assert.ok(names.includes("tilawa-v1-prefs"));
  assert.ok(names.includes("some-model-cache"));
});

test("self-hosted model files and dev paths are not handled by the service worker", async () => {
  const sw = createWorker(async () => css(""));
  assert.equal((await sw.fire("fetch", { request: sw.request("/tilawa-v1/model.onnx") })).handled, false);
  assert.equal((await sw.fire("fetch", { request: sw.request("/src/app/app.ts") })).handled, false);
});
