/// <reference lib="webworker" />
import * as ort from "onnxruntime-web/wasm";
import wasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import { createRecognitionSession, type RecognitionSession, type ZipformerIo } from "@tilawa/core";
import type { RecognitionEvent } from "../recognition/types";
import { toRecognitionEvent, type TilawaWorkerCommand } from "../recognition/tilawa/types";
import { recognitionDebugEnabled } from "../recognition/debug";

const ASSET_BASE = "/tilawa";
let recognition: RecognitionSession | null = null;

const post = (event: RecognitionEvent) => self.postMessage(event);

async function loadJson<T>(file: string): Promise<T> {
  const response = await fetch(`${ASSET_BASE}/${file}`);
  if (!response.ok) throw new Error(`Aset ${file} belum tersedia (${response.status}). Ikuti public/tilawa/README.md.`);
  return response.json() as Promise<T>;
}

async function initialize(): Promise<void> {
  if (recognitionDebugEnabled) {
    console.debug("[ZIPFORMER]", { engineState: "initializing", event: "initialization_started" });
  }
  post({ type: "loading_status", message: "Memuat aset Tilawa…" });
  const [corpus, quran, io, model] = await Promise.all([
    loadJson<unknown>("zipformer_quran.json"),
    loadJson<unknown[]>("quran.json"),
    loadJson<ZipformerIo>("zipformer_a0w_ep1_a05.io.json"),
    fetch(`${ASSET_BASE}/zipformer_a0w_ep1_a05.int8.onnx`).then(async (response) => {
      if (!response.ok) throw new Error("Model Zipformer ONNX belum tersedia. Lihat public/tilawa/README.md.");
      return response.arrayBuffer();
    }),
  ]);

  if (recognitionDebugEnabled) {
    console.debug("[ZIPFORMER]", { event: "assets_loaded" });
  }
  post({ type: "loading_status", message: "Menyiapkan mesin pengenalan…" });
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.wasmPaths = { wasm: wasmUrl };

  recognition = await createRecognitionSession({
    engine: "zipformer",
    stayOnSurah: true,
    ort,
    model,
    corpus,
    quran,
    io,
    executionProviders: ["wasm"],
    onEvent(message) {
      const event = toRecognitionEvent(message);
      if (!event) return;
      if (recognitionDebugEnabled) {
        console.debug("[ZIPFORMER]", event.type === "verse_match"
          ? {
              event: event.type,
              surah: event.surah,
              ayah: event.ayah,
              confidence: event.confidence
            }
          : {
              event: event.type,
              surah: event.surah,
              ayah: event.ayah,
              wordIndex: event.word_index,
              totalWords: event.total_words
            });
      }
      post(event);
    },
  });
  if (recognitionDebugEnabled) {
    console.debug("[ZIPFORMER]", { engineState: "ready", event: "initialized" });
  }
  post({ type: "ready" });
}

self.onmessage = async ({ data }: MessageEvent<TilawaWorkerCommand>) => {
  try {
    if (data.type === "init") await initialize();
    if (data.type === "reset") recognition?.reset();
    if (data.type === "audio") await recognition?.feed(data.samples);
  } catch (error) {
    if (recognitionDebugEnabled) {
      console.debug("[ZIPFORMER]", {
        event: "worker_error",
        command: data.type,
        message: error instanceof Error ? error.message : String(error)
      });
    }
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
