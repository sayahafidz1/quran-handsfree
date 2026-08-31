/// <reference lib="webworker" />
import * as ort from "onnxruntime-web/wasm";
import { createTilawaSession, type CtcTokenTable, type TilawaSession } from "@tilawa/core";
import type { RecognitionEvent } from "../recognition/types";
import type { TilawaWorkerCommand } from "../recognition/tilawa/types";

const ASSET_BASE = "/tilawa";
let tilawa: TilawaSession | null = null;

const post = (event: RecognitionEvent) => self.postMessage(event);

async function loadJson<T>(file: string): Promise<T> {
  const response = await fetch(`${ASSET_BASE}/${file}`);
  if (!response.ok) throw new Error(`Aset ${file} belum tersedia (${response.status}). Ikuti public/tilawa/README.md.`);
  return response.json() as Promise<T>;
}

async function initialize(): Promise<void> {
  post({ type: "loading_status", message: "Memuat aset Tilawa…" });
  const [vocab, quranCtcTokens, quran, model] = await Promise.all([
    loadJson<Record<string, string>>("vocab.json"),
    loadJson<CtcTokenTable>("quran_ctc_tokens.json"),
    loadJson<unknown[]>("quran.json"),
    fetch(`${ASSET_BASE}/fastconformer_full_mixed.onnx`).then(async (response) => {
      if (!response.ok) throw new Error("Model ONNX belum tersedia. Lihat public/tilawa/README.md.");
      return response.arrayBuffer();
    }),
  ]);

  post({ type: "loading_status", message: "Menyiapkan mesin pengenalan…" });
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
  tilawa = createTilawaSession({
    async run(audio) {
      const audioSignal = new ort.Tensor("float32", audio, [1, audio.length]);
      const length = new ort.Tensor("int64", BigInt64Array.from([BigInt(audio.length)]), [1]);
      const result = await session.run({ audio_signal: audioSignal, length });
      const output = result[session.outputNames[0]];
      const [, timeSteps, vocabSize] = output.dims as number[];
      return { logprobs: output.data as Float32Array, timeSteps, vocabSize };
    },
  }, { vocab, quranCtcTokens, quran }, {
    onOutput(message) {
      if (message.type === "verse_match") post(message);
      if (message.type === "word_progress") post(message);
    },
  });
  post({ type: "ready" });
}

self.onmessage = async ({ data }: MessageEvent<TilawaWorkerCommand>) => {
  try {
    if (data.type === "init") await initialize();
    if (data.type === "reset") tilawa?.reset();
    if (data.type === "audio") await tilawa?.feed(data.samples);
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
