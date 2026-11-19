import test from "node:test";
import assert from "node:assert/strict";
import { createReaderHistory, type HistoryLike } from "../src/app/readerHistory.ts";

function fakeHistory(initial: unknown = null) {
  const stack: unknown[] = [initial];
  let index = 0;
  const calls: string[] = [];
  const history: HistoryLike = {
    get state() { return stack[index]; },
    pushState(state) { stack.splice(index + 1); stack.push(state); index++; calls.push("push"); },
    replaceState(state) { stack[index] = state; calls.push("replace"); },
    back() { if (index > 0) index--; calls.push("back"); }
  };
  return { history, calls, depth: () => stack.length };
}

test("opening the reading screen adds exactly one history entry, even when asked twice", () => {
  const { history, calls } = fakeHistory();
  const readerHistory = createReaderHistory(history);
  readerHistory.enter();
  readerHistory.enter();
  assert.deepEqual(calls, ["push"]);
});

test("Kembali goes back one entry while the reading entry is current", () => {
  const { history, calls } = fakeHistory();
  const readerHistory = createReaderHistory(history);
  readerHistory.enter();
  assert.equal(readerHistory.leave(), "back");
  assert.deepEqual(calls, ["push", "back"]);
  assert.equal(history.state, null);
});

test("Kembali with no reading entry (already left by the back button) closes directly", () => {
  const { history, calls } = fakeHistory();
  const readerHistory = createReaderHistory(history);
  assert.equal(readerHistory.leave(), "direct");
  assert.deepEqual(calls, []);
});

test("a reading entry left over from a page reload is cleared at startup", () => {
  const { history } = fakeHistory({ view: "baca" });
  createReaderHistory(history).init();
  assert.notDeepEqual(history.state, { view: "baca" });
});
