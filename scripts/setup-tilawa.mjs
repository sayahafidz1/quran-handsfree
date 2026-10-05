#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = [
  {
    name: "zipformer_a0w_ep1_a05.int8.onnx",
    source: "https://github.com/yazinsai/tilawa/releases/download/zipformer-a0w-ep1-a0.5/zipformer_a0w_ep1_a05.int8.onnx",
    bytes: 69246033,
    sha256: "bfb5b712695634a6099b45a6a78003bd5103417c4eae6338277d54679254905a",
  },
  {
    name: "zipformer_a0w_ep1_a05.io.json",
    source: "https://github.com/yazinsai/tilawa/releases/download/zipformer-a0w-ep1-a0.5/zipformer_a0w_ep1_a05.io.json",
    bytes: 26867,
    sha256: "7dca1dafd6ee26044a0d3ba6b9483278203f55df7cc95d40cda865183a0d797e",
    json: "object",
  },
  {
    name: "zipformer_quran.json",
    source: "https://github.com/yazinsai/tilawa/releases/download/v0.3.0/zipformer_quran.json",
    bytes: 5453439,
    sha256: "24360c05ec88fcacf3419c1fe6cd81d69e653326a0bf0e4fb507e7b98fc88127",
    json: "object",
  },
  {
    name: "quran.json",
    source: "https://github.com/yazinsai/tilawa/releases/download/v0.2.0/quran.json",
    bytes: 3186385,
    sha256: "6e6f31f642c701b49a1ba090311ca4c7a97c6a5b79a302712dff815a9d7b3d03",
    json: "array",
  },
  {
    name: "NPL-1.2.txt",
    source: "https://github.com/yazinsai/tilawa/releases/download/v0.3.0/NPL-1.2.txt",
    bytes: 7041,
    sha256: "77526bdbfac94132e5114c3a34492c33f915e4b7f310f00b9995500d3610cab5",
  },
];

const targetDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "tilawa");

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function isValidAsset(asset, filePath) {
  if (!fs.existsSync(filePath)) return false;

  const stat = fs.statSync(filePath);
  if (stat.size !== asset.bytes || hashFile(filePath) !== asset.sha256) return false;

  if (asset.json) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return false;
    }
    if (asset.json === "array" && !Array.isArray(parsed)) return false;
    if (asset.json === "object" && (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))) return false;
  }

  return true;
}

async function ensureAsset(asset) {
  const filePath = path.join(targetDir, asset.name);
  const displayName = asset.name.padEnd(38, " ");

  if (isValidAsset(asset, filePath)) {
    console.log(`${displayName} already available`);
    return;
  }

  console.log(`${displayName} downloading...`);
  const response = await fetch(asset.source, {
    headers: { "User-Agent": "quran-handsfree-setup/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${asset.name}: ${response.status} ${response.statusText}`);
  }

  const tempPath = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempPath, Buffer.from(await response.arrayBuffer()));
    if (!isValidAsset(asset, tempPath)) {
      throw new Error(`Downloaded ${asset.name} failed its pinned size, SHA-256, or format check`);
    }
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

async function main() {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log("Quran Hands-Free — Tilawa Zipformer Setup\n");
  console.log("Model:     @tilawa/core 0.4.0 (zipformer-a0w-ep1-a0.5)");
  console.log("Corpus:    Tilawa v0.3.0");
  console.log("Display:   Tilawa v0.2.0 (optional Arabic text)\n");
  console.log("Checking assets...");

  for (const asset of ASSETS) {
    await ensureAsset(asset);
  }

  console.log("\nTilawa Zipformer runtime setup completed.");
}

main().catch((error) => {
  console.error(`\nERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
