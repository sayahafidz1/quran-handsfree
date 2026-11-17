import test from "node:test";
import assert from "node:assert/strict";
import { createListenGate } from "../src/app/listenGate.ts";

test("when the model is ready, a listen request starts the microphone at once", () => {
  const gate = createListenGate();
  gate.setPreparing(true);
  assert.equal(gate.onReady(), "none");
  assert.equal(gate.request(), "start");
});

test("a request while the model is loading waits, then starts when it is ready", () => {
  const gate = createListenGate();
  gate.setPreparing(true);
  assert.equal(gate.request(), "wait");
  assert.equal(gate.onReady(), "start");
});

test("a request before loading began asks the app to prepare first", () => {
  const gate = createListenGate();
  assert.equal(gate.shouldPrepare(), true);
  assert.equal(gate.request(), "prepare");
  gate.setPreparing(true);
  assert.equal(gate.shouldPrepare(), false);
  assert.equal(gate.request(), "wait");
  assert.equal(gate.onReady(), "start");
});

test("already listening: requests do nothing and a waiting request does not start twice", () => {
  const gate = createListenGate();
  gate.setPreparing(true);
  assert.equal(gate.request(), "wait");
  gate.setListening(true);
  assert.equal(gate.onReady(), "none");
  assert.equal(gate.request(), "none");
});

test("a loading error drops the waiting request and allows loading again", () => {
  const gate = createListenGate();
  gate.setPreparing(true);
  assert.equal(gate.request(), "wait");
  gate.onError();
  assert.equal(gate.shouldPrepare(), true);
  gate.setPreparing(true);
  assert.equal(gate.onReady(), "none");
  assert.equal(gate.request(), "start");
});

test("after a stop, a new request starts the microphone again", () => {
  const gate = createListenGate();
  gate.setPreparing(true);
  gate.onReady();
  gate.setListening(true);
  assert.equal(gate.request(), "none");
  gate.setListening(false);
  assert.equal(gate.request(), "start");
});

test("once ready, the model is not prepared again", () => {
  const gate = createListenGate();
  gate.setPreparing(true);
  gate.onReady();
  assert.equal(gate.shouldPrepare(), false);
});

test("an error after the model was ready still allows loading it again", () => {
  const gate = createListenGate();
  gate.setPreparing(true);
  gate.onReady();
  gate.onError();
  assert.equal(gate.shouldPrepare(), true);
});
