import test, { afterEach, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { START_TIMEOUT_MS, WebSpeechCommandRecognizer } from "../src/command/recognizers/WebSpeechCommandRecognizer.ts";
import { hasCapacitor } from "../src/app/backAction.ts";
import type { CommandRecognitionEvent } from "../src/command/types.ts";

// Pengenal Web Speech palsu: tes mengendalikan kapan ia "mulai", "berhasil", atau "berakhir".
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  aborted = false;
  stopped = false;
  [handler: string]: any;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {}
  stop() {
    this.stopped = true;
  }
  abort() {
    this.aborted = true;
  }
}
const resultEvent = (transcript: string, isFinal: boolean) => ({
  resultIndex: 0,
  results: [Object.assign([{ transcript }], { isFinal })]
});

let events: CommandRecognitionEvent[] = [];
const errors = () => events.filter((e) => e.type === "error");

beforeEach(() => {
  events = [];
  FakeRecognition.last = null;
  (globalThis as any).window = { webkitSpeechRecognition: FakeRecognition };
  mock.timers.enable({ apis: ["setTimeout"] });
});
afterEach(() => {
  mock.timers.reset();
  delete (globalThis as any).window;
});

async function startListening() {
  const recognizer = new WebSpeechCommandRecognizer();
  await recognizer.start((event) => events.push(event));
  return { recognizer, fake: FakeRecognition.last! };
}

test("not supported without a Speech API in the window", () => {
  (globalThis as any).window = {};
  assert.equal(new WebSpeechCommandRecognizer().isSupported(), false);
});

test("a recognizer that never starts (WebView) reports one error after the timeout, and aborts", async () => {
  const { fake } = await startListening();
  mock.timers.tick(START_TIMEOUT_MS - 1);
  assert.equal(errors().length, 0, "terlalu cepat");
  mock.timers.tick(1);
  assert.equal(errors().length, 1);
  assert.match((errors()[0] as { message: string }).message, /tidak merespons/);
  assert.equal(fake.aborted, true);
  fake.onend?.(); // abort() memicu end: tidak boleh menambah galat kedua
  assert.equal(errors().length, 1);
});

test("a recognizer that starts in time is not reported as unresponsive", async () => {
  const { fake } = await startListening();
  fake.onstart?.();
  mock.timers.tick(START_TIMEOUT_MS * 3);
  assert.equal(errors().length, 0);
});

test("a spoken command still gives a final transcript and a parsed command, and no error afterwards", async () => {
  const { fake } = await startListening();
  fake.onstart?.();
  fake.onresult?.(resultEvent("Al-Baqarah ayat 255", true));
  fake.onend?.();
  const result = events.find((e) => e.type === "command_result");
  assert.ok(result && result.type === "command_result" && result.result.success);
  assert.equal(errors().length, 0);
});

test("ending with no result and no error tells the user once, so the button can come back", async () => {
  const { fake } = await startListening();
  fake.onstart?.();
  fake.onend?.();
  assert.equal(errors().length, 1);
  assert.match((errors()[0] as { message: string }).message, /Tidak ada perintah/);
});

test("an engine error is reported once even though end follows it", async () => {
  const { fake } = await startListening();
  fake.onstart?.();
  fake.onerror?.({ error: "no-speech" });
  fake.onend?.();
  assert.equal(errors().length, 1);
});

test("stopping by hand never produces an error, including when the engine never started", async () => {
  const first = await startListening();
  first.fake.onstart?.();
  await first.recognizer.stop();
  first.fake.onend?.();
  assert.equal(errors().length, 0);

  events = [];
  const second = await startListening(); // tidak pernah "start" (macet), pengguna menekan Berhenti
  await second.recognizer.stop();
  assert.equal(second.fake.stopped, true);
  mock.timers.tick(START_TIMEOUT_MS * 2);
  second.fake.onend?.();
  assert.equal(errors().length, 0);
});

test("a new listening session starts clean after an error", async () => {
  const first = await startListening();
  mock.timers.tick(START_TIMEOUT_MS);
  assert.equal(errors().length, 1);
  events = [];
  const again = await startListening();
  again.fake.onstart?.();
  again.fake.onresult?.(resultEvent("Surat Yasin ayat 58", true));
  assert.equal(errors().length, 0);
  assert.ok(events.some((e) => e.type === "command_result"));
  void first;
});

// Penyambungan: di APK kartu suara disembunyikan dan kartu perbaikan tampil; di Web sebaliknya.
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the voice card and the maintenance card exist in the Cari tab and app.ts switches them with hasCapacitor", () => {
  const html = read("index.html");
  const cari = html.slice(html.indexOf('id="view-cari"'), html.indexOf('id="view-info"'));
  assert.ok(cari.includes('id="voice-card"'));
  assert.match(cari, /id="voice-maintenance"[^>]*\bhidden\b/, "kartu perbaikan harus tersembunyi bawaan (tampil hanya di APK)");
  assert.ok(!/id="voice-card"[^>]*\bhidden\b/.test(cari), "kartu suara harus tampil bawaan (Web tidak berubah)");
  assert.ok(cari.slice(cari.indexOf('id="voice-card"'), cari.indexOf('id="voice-maintenance"')).includes('id="command-voice"'));
  assert.ok(cari.slice(0, cari.indexOf('id="voice-card"')).includes('id="navigation-open"'), "Navigasi Quran harus tetap di luar kartu suara");
  const app = read("src/app/app.ts");
  assert.ok(app.includes("hasCapacitor(window)"));
  assert.ok(app.includes('"#voice-card"') && app.includes('"#voice-maintenance"'));
});

test("the APK is told apart from the browser by the same check the back button uses", () => {
  assert.equal(hasCapacitor({}), false, "Web: kartu suara tampil");
  assert.equal(hasCapacitor({ Capacitor: {} }), true, "APK: kartu suara disembunyikan");
});

// Beberapa tebakan (alternatif) untuk satu ucapan akhir, urutan paling yakin dulu.
const alternativesEvent = (guesses: string[]) => ({
  resultIndex: 0,
  results: [Object.assign(guesses.map((transcript) => ({ transcript })), { isFinal: true })]
});
const commandResult = () => {
  const found = events.find((e) => e.type === "command_result");
  assert.ok(found && found.type === "command_result");
  return found.result;
};
const finalTranscript = () => {
  const found = events.filter((e) => e.type === "transcript" && e.isFinal).at(-1);
  assert.ok(found && found.type === "transcript");
  return found.transcript;
};

test("the recognizer asks the engine for alternatives", async () => {
  const { fake } = await startListening();
  assert.equal(fake.maxAlternatives, 3);
});

test("when the first guess is a valid command it wins, even if the others are also valid", async () => {
  const { fake } = await startListening();
  fake.onresult?.(alternativesEvent(["Al-Baqarah ayat 255", "Ali Imran ayat 3", "An-Nisa ayat 1"]));
  const result = commandResult();
  assert.ok(result.success && result.command === "open");
  assert.equal(result.success && result.command === "open" ? result.surah : 0, 2);
  assert.equal(finalTranscript(), "Al-Baqarah ayat 255");
});

test("when the first guess is not a command, the second is tried and shown as what was understood", async () => {
  const { fake } = await startListening();
  fake.onresult?.(alternativesEvent(["bla bla tidak jelas", "Al-Baqarah ayat 255", "Ali Imran ayat 3"]));
  const result = commandResult();
  assert.ok(result.success && result.command === "open");
  assert.equal(result.success && result.command === "open" ? result.surah : 0, 2);
  assert.equal(result.success && result.command === "open" ? result.ayah : 0, 255);
  assert.equal(finalTranscript(), "Al-Baqarah ayat 255");
});

test("the third guess is used when the first two fail", async () => {
  const { fake } = await startListening();
  fake.onresult?.(alternativesEvent(["bla bla", "xyz xyz", "Ali Imran ayat 3"]));
  const result = commandResult();
  assert.ok(result.success && result.command === "open");
  assert.equal(result.success && result.command === "open" ? result.surah : 0, 3);
});

test("when every guess fails the failure and the transcript come from the first guess", async () => {
  const { fake } = await startListening();
  fake.onresult?.(alternativesEvent(["bla bla", "xyz xyz", "qwerty"]));
  const result = commandResult();
  assert.equal(result.success, false);
  assert.equal(finalTranscript(), "bla bla");
  assert.equal(errors().length, 0);
});

test("repeated identical guesses are handled and a single guess behaves as before", async () => {
  const { fake } = await startListening();
  fake.onresult?.(alternativesEvent(["Al-Baqarah ayat 255", "Al-Baqarah ayat 255"]));
  const result = commandResult();
  assert.ok(result.success && result.command === "open");
  assert.equal(finalTranscript(), "Al-Baqarah ayat 255");
});

test("a control command heard as a later guess is accepted too (next)", async () => {
  const { fake } = await startListening();
  fake.onresult?.(alternativesEvent(["bla bla", "berikutnya"]));
  const result = commandResult();
  assert.ok(result.success && result.command === "next");
});

test("interim results still never produce a command", async () => {
  const { fake } = await startListening();
  fake.onresult?.(resultEvent("Al-Baqarah ayat 255", false));
  assert.equal(events.some((e) => e.type === "command_result"), false);
});
