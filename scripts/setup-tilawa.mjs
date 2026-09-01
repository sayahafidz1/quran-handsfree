#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE_TAG = "v0.2.0";
const RELEASE_BASE = `https://github.com/yazinsai/tilawa/releases/download/${RELEASE_TAG}`;
const ASSET_NAMES = [
  "vocab.json",
  "quran_ctc_tokens.json",
  "quran.json",
  "fastconformer_full_mixed.onnx",
  "export_metadata.json",
];

const targetDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "tilawa");

function fail(message) {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

function safeJsonParse(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readMetadata() {
  const metadataPath = path.join(targetDir, "export_metadata.json");
  if (!fs.existsSync(metadataPath)) {
    return {};
  }

  const parsed = safeJsonParse(metadataPath);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  const file = fs.readFileSync(filePath);
  hash.update(file);
  return hash.digest("hex");
}

function isValidAsset(assetName, filePath, metadata) {
  if (!fs.existsSync(filePath)) return false;

  const stat = fs.statSync(filePath);
  if (stat.size <= 0) return false;

  if (assetName.endsWith(".json")) {
    const parsed = safeJsonParse(filePath);
    if (parsed === null) return false;
    if (assetName === "quran.json" && !Array.isArray(parsed)) return false;
    if (assetName !== "quran.json" && typeof parsed !== "object") return false;
  }

  const hashKeyMap = {
    "vocab.json": "vocab_sha256",
    "quran_ctc_tokens.json": "quran_ctc_tokens_sha256",
    "fastconformer_full_mixed.onnx": "onnx_sha256",
  };

  const expectedHash = hashKeyMap[assetName] ? metadata[hashKeyMap[assetName]] : null;
  if (expectedHash && typeof expectedHash === "string") {
    return hashFile(filePath) === expectedHash.toLowerCase();
  }

  return true;
}

async function downloadAsset(assetName) {
  const filePath = path.join(targetDir, assetName);
  const response = await fetch(`${RELEASE_BASE}/${assetName}`, {
    headers: {
      "User-Agent": "quran-handsfree-setup/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
}

async function ensureAsset(assetName, metadata) {
  const filePath = path.join(targetDir, assetName);
  const displayName = assetName.padEnd(32, " ");

  if (fs.existsSync(filePath) && isValidAsset(assetName, filePath, metadata)) {
    console.log(`${displayName} already available`);
    return;
  }

  console.log(`${displayName} downloading...`);

  try {
    await downloadAsset(assetName);
  } catch {
    fail(
      `Failed to download ${assetName}.\n\nSource:\nTilawa ${RELEASE_TAG} official GitHub Release.\n\nPlease check your internet connection and run:\n\nnpm run setup\n`,
    );
  }

  if (!isValidAsset(assetName, filePath, metadata)) {
    fail(`Downloaded ${assetName} but validation failed. Please rerun npm run setup.`);
  }
}

async function main() {
  fs.mkdirSync(targetDir, { recursive: true });

  console.log("Quran Hands-Free — Tilawa Setup");
  console.log("");
  console.log(`Release: Tilawa ${RELEASE_TAG}`);
  console.log("");
  console.log("Checking assets...");

  const metadata = readMetadata();

  for (const assetName of ASSET_NAMES) {
    await ensureAsset(assetName, metadata);
  }

  console.log("");
  console.log("Tilawa runtime setup completed.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
