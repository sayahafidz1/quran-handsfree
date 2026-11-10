/// <reference lib="webworker" />
import * as ort from "onnxruntime-web/wasm";
import wasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import { createRecognitionSession, type RecognitionSession, type ZipformerIo } from "@tilawa/core";
import type { RecognitionEvent } from "../recognition/types";
import { toRecognitionEvent, type TilawaWorkerCommand } from "../recognition/tilawa/types";
import { getTranscriptDelta, summarizeAudioChunk } from "../recognition/tilawa/diagnostics";
import { recognitionDebugEnabled } from "../recognition/debug";

const ASSET_BASE = "/tilawa";
let recognition: RecognitionSession | null = null;
let audioChunkIndex = 0;
let activeAudioChunkIndex: number | null = null;
let previousTranscript = "";

const post = (event: RecognitionEvent) => self.postMessage(event);

async function loadJson<T>(file: string): Promise<T> {
  const response = await fetch(`${ASSET_BASE}/${file}`);
  if (!response.ok) throw new Error(`Aset ${file} belum tersedia (${response.status}). Ikuti public/tilawa/README.md.`);
  return response.json() as Promise<T>;
}

async function initialize(): Promise<void> {
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
      if (recognitionDebugEnabled) {
        let output: unknown = message;
        if (message.type === "raw_transcript") {
          const delta = getTranscriptDelta(previousTranscript, message.text);
          previousTranscript = message.text;
          output = { ...message, transcriptDelta: delta.text, transcriptRevised: delta.revised };
        }
        console.debug("[ZIPFORMER_IO]", {
          audioChunkIndex: activeAudioChunkIndex,
          zipformerOutput: output,
          recognitionEvent: event
        });
      }
      if (!event) return;
      post(event);
    },
  });
  post({ type: "ready" });
}

let commandQueue = Promise.resolve();

async function handleCommand(data: TilawaWorkerCommand): Promise<void> {
  try {
    if (data.type === "init") await initialize();
    if (data.type === "reset") {
      recognition?.reset();
      audioChunkIndex = 0;
      activeAudioChunkIndex = null;
      previousTranscript = "";
    }
    if (data.type === "audio") {
      if (recognition) {
        const index = ++audioChunkIndex;
        activeAudioChunkIndex = index;
        // if (recognitionDebugEnabled) {
        //   console.debug("[ZIPFORMER_AUDIO]", {
        //     index,
        //     ...summarizeAudioChunk(data.samples)
        //   });
        // }
        try {
          await recognition.feed(data.samples);
        } finally {
          activeAudioChunkIndex = null;
        }
      }
    }
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
}

self.onmessage = ({ data }: MessageEvent<TilawaWorkerCommand>) => {
  commandQueue = commandQueue.then(() => handleCommand(data));
};
