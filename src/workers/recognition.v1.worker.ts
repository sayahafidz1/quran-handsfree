/// <reference lib="webworker" />
// Evaluation worker for Tilawa 1.0 (branch eval/tilawa-1.0). The 0.4.0 worker is untouched.
import * as ort from "onnxruntime-web/all";
import { createTilawa } from "tilawa-v1/web";
import { SessionEndedError } from "tilawa-v1";
import type { EngineEvent, ReferenceAsset, Tilawa, TilawaSession } from "tilawa-v1";
import referenceUrl from "tilawa-v1/assets/ref-v2.json?url";
import type { RecognitionEvent } from "../recognition/types";
import type { TilawaWorkerCommand } from "../recognition/tilawa/types";
import { V1PositionMapper, type V1Event } from "../recognition/tilawa/v1Mapper";
import { recognitionDebugEnabled } from "../recognition/debug";
import {
  createMemoryStorage,
  fallbackTier,
  localAssetBase,
  parseAssetMode,
  parseProviders,
  resolveTier,
  type V1Tier
} from "../recognition/tilawa/v1Assets";

const SAMPLE_RATE = 16000;

let tilawa: Tilawa | null = null;
let session: TilawaSession | null = null;
let mapper: V1PositionMapper | null = null;

const post = (event: RecognitionEvent) => self.postMessage(event);

function reportProgress(progress: { stage: string; fraction: number; fromCache: boolean }): void {
  if (progress.stage !== "model") return;
  const percent = Math.round(progress.fraction * 100);
  post({ type: "loading_status", message: `Model Tilawa 1.0: ${percent}%${progress.fromCache ? " (dari cache)" : ""}` });
}

async function initialize(): Promise<void> {
  post({ type: "loading_status", message: "Memuat referensi Al-Qur'an Tilawa 1.0…" });
  const response = await fetch(referenceUrl);
  if (!response.ok) throw new Error(`Referensi Tilawa 1.0 gagal dimuat (${response.status}).`);
  const reference = (await response.json()) as ReferenceAsset;

  // Words per ayah (Uthmani, from the same reference the engine uses), for total_words and verse_text.
  const wordsByAyah = new Map<string, readonly string[]>();
  for (const ayah of reference.ayahs) wordsByAyah.set(`${ayah.s}:${ayah.a}`, ayah.w);
  mapper = new V1PositionMapper((surah, ayah) => wordsByAyah.get(`${surah}:${ayah}`));

  const mode = parseAssetMode(import.meta.env.VITE_TILAWA_V1_ASSETS);
  const tier = resolveTier(mode, import.meta.env.VITE_TILAWA_V1_TIER);
  const providers = parseProviders(import.meta.env.VITE_TILAWA_V1_PROVIDERS);

  try {
    if (mode === "local") {
      // Self-hosted: model and onnxruntime-web files come from this app's own origin (`npm run setup:v1`),
      // the reference is bundled, and nothing is kept in the browser cache.
      post({ type: "loading_status", message: "Memuat model Tilawa 1.0 dari aplikasi (tanpa internet)…" });
      tilawa = await createTilawa({
        tier,
        reference,
        providers,
        assetBase: localAssetBase(self.location.origin, import.meta.env.BASE_URL),
        storage: createMemoryStorage(),
        onProgress: reportProgress
      });
    } else {
      // Remote: Tilawa 1.0 loads onnxruntime-web files from tilawa.dev for one specific version (1.30.0). Our
      // installed onnxruntime-web may differ, so point the loader at the files of the version we actually have.
      const ortVersion = (ort.env as { versions?: { web?: string } }).versions?.web;
      const wasmPaths = ortVersion ? `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ortVersion}/dist/` : undefined;
      post({ type: "loading_status", message: "Memuat model Tilawa 1.0 (unduhan pertama bisa besar)…" });
      const load = (useTier: V1Tier) =>
        createTilawa({ tier: useTier, reference, providers, wasmPaths, onProgress: reportProgress });
      try {
        tilawa = await load(tier);
      } catch (firstError) {
        // A weak phone may not have the memory for the full model; try the smaller one automatically.
        const fallback = fallbackTier(mode, tier);
        if (!fallback) throw firstError;
        const firstDetail = firstError instanceof Error ? firstError.message : String(firstError);
        if (recognitionDebugEnabled) {
          console.debug("[TILAWA_V1]", { event: "tier_fallback", from: tier, to: fallback, message: firstDetail });
        }
        post({
          type: "loading_status",
          message: "Model penuh gagal dimuat (kemungkinan memori perangkat kurang). Memakai model ringan; ketepatan bisa lebih rendah…"
        });
        try {
          tilawa = await load(fallback);
        } catch (secondError) {
          const secondDetail = secondError instanceof Error ? secondError.message : String(secondError);
          throw new Error(`${firstDetail} | Model ringan juga gagal: ${secondDetail}`);
        }
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      mode === "local"
        ? `${detail} (Mode lokal: jalankan "npm run setup:v1" lalu muat ulang.)`
        : detail
    );
  }
  if (recognitionDebugEnabled) {
    console.debug("[TILAWA_V1]", { event: "ready", model: tilawa.model });
  }
  startSession();
  post({ type: "ready" });
}

/** Tilawa 1.0 sessions are one-shot, so "reset" ends the old session and starts a fresh one. */
function startSession(): void {
  if (!tilawa || !mapper) return;
  session?.dispose();
  mapper.reset();
  const activeMapper = mapper;
  session = tilawa.startFreeRecitation();
  session.subscribe((event: EngineEvent) => {
    const mapped = activeMapper.map(event as V1Event);
    if (recognitionDebugEnabled && (event.type !== "capabilities")) {
      console.debug("[TILAWA_V1]", { engineEvent: event, recognitionEvents: mapped });
    }
    for (const item of mapped) post(item);
  });
}

let commandQueue = Promise.resolve();

async function handleCommand(data: TilawaWorkerCommand): Promise<void> {
  try {
    if (data.type === "init") await initialize();
    if (data.type === "reset") startSession();
    if (data.type === "audio" && session) {
      await session.pushAudio(data.samples, SAMPLE_RATE);
    }
  } catch (error) {
    // A reset can end the session while audio is still queued; that is expected.
    if (error instanceof SessionEndedError) return;
    if (recognitionDebugEnabled) {
      console.debug("[TILAWA_V1]", {
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
