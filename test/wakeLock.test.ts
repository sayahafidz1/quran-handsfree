import test from "node:test";
import assert from "node:assert/strict";
import { createWakeLockController, type WakeLockSentinelLike } from "../src/app/wakeLock.ts";

function fakeEnv(options: { visible?: boolean; fail?: boolean; delayMs?: number } = {}) {
  const state = { visible: options.visible ?? true, requests: 0, released: 0 };
  const sentinels: Array<WakeLockSentinelLike & { fireRelease(): void }> = [];
  const request = async () => {
    state.requests += 1;
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    if (options.fail) throw new Error("NotAllowedError");
    const listeners: Array<() => void> = [];
    const sentinel = {
      release: async () => {
        state.released += 1;
        listeners.forEach((listener) => listener());
      },
      addEventListener: (_type: "release", listener: () => void) => void listeners.push(listener),
      fireRelease: () => listeners.forEach((listener) => listener())
    };
    sentinels.push(sentinel);
    return sentinel;
  };
  return { state, sentinels, env: { request, isVisible: () => state.visible } };
}

test("listening asks for the screen lock once and stopping releases it", async () => {
  const { state, env } = fakeEnv();
  const controller = createWakeLockController(env);
  await controller.enable();
  await controller.enable();
  assert.equal(state.requests, 1);
  assert.equal(controller.isActive(), true);
  await controller.disable();
  assert.equal(state.released, 1);
  assert.equal(controller.isActive(), false);
});

test("after the browser releases the lock (page hidden), it is requested again when visible", async () => {
  const { state, sentinels, env } = fakeEnv();
  const controller = createWakeLockController(env);
  await controller.enable();
  state.visible = false;
  sentinels[0].fireRelease();
  assert.equal(controller.isActive(), false);
  await controller.onVisible();
  assert.equal(state.requests, 1);
  state.visible = true;
  await controller.onVisible();
  assert.equal(state.requests, 2);
  assert.equal(controller.isActive(), true);
});

test("when listening is not wanted, becoming visible does not request a lock", async () => {
  const { state, env } = fakeEnv();
  const controller = createWakeLockController(env);
  await controller.onVisible();
  await controller.enable();
  await controller.disable();
  await controller.onVisible();
  assert.equal(state.requests, 1);
  assert.equal(controller.isActive(), false);
});

test("a browser without the Wake Lock API, or a denied request, does not break listening", async () => {
  const unsupported = createWakeLockController({ isVisible: () => true });
  await unsupported.enable();
  assert.equal(unsupported.isActive(), false);
  await unsupported.disable();

  const { env } = fakeEnv({ fail: true });
  const denied = createWakeLockController(env);
  await denied.enable();
  assert.equal(denied.isActive(), false);
});

test("stopping while the browser is still granting the lock releases it at once", async () => {
  const { state, env } = fakeEnv({ delayMs: 20 });
  const controller = createWakeLockController(env);
  const pending = controller.enable();
  await controller.disable();
  await pending;
  assert.equal(controller.isActive(), false);
  assert.equal(state.released, 1);
});
