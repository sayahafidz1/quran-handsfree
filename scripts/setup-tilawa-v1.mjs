#!/usr/bin/env node
// Fills public/tilawa-v1/ so the Tilawa 1.0 path can run with no internet at all
// (VITE_TILAWA_ENGINE=v1 + VITE_TILAWA_V1_ASSETS=local). Run `npm install` first.
//
//   npm run setup:v1                 model "full" (68 MB) + onnxruntime-web files + licence notices
//   npm run setup:v1 -- --tier=lite  model "lite" (25 MB) instead
//   npm run setup:v1 -- --tier=both  both models
//
// The model sizes and SHA-256 values below are the ones in @tilawa/core 1.0.0-rc.0's own model registry
// (MODEL_REGISTRY). Layout matches https://tilawa.dev/v1/, which is what the SDK expects for `assetBase`.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "https://tilawa.dev/v1/";
const MODELS = {
  full: {
    path: "models/spliced-clean/1-int8/model.onnx",
    bytes: 67759744,
    sha256: "714e98addee73b1b8781ad7d99b6d3c745acd9116638baf4e12891f53a15af1b",
  },
  lite: {
    path: "models/spliced-clean-lite/1-int8/model.onnx",
    bytes: 24650054,
    sha256: "4974de78d3c35d2542e7a24d99b747e1160d6e31e366fb68492b74a789890f1b",
  },
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "tilawa-v1");

function fail(message) {
  throw new Error(message);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function isValid(file, filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).size === file.bytes && sha256File(filePath) === file.sha256;
}

async function ensureModel(name, file) {
  const target = path.join(outDir, file.path);
  const label = `model ${name}`.padEnd(14, " ");
  if (isValid(file, target)) {
    console.log(`${label} sudah ada dan cocok`);
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  console.log(`${label} mengunduh ${(file.bytes / 1e6).toFixed(1)} MB dari ${SOURCE}${file.path} ...`);
  const response = await fetch(SOURCE + file.path, { headers: { "User-Agent": "quran-handsfree-setup/1.0" } });
  if (!response.ok) fail(`Gagal mengunduh ${file.path}: ${response.status} ${response.statusText}`);
  const temp = `${target}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, Buffer.from(await response.arrayBuffer()));
    if (!isValid(file, temp)) fail(`${file.path} gagal pemeriksaan ukuran atau SHA-256; file dibuang.`);
    fs.renameSync(temp, target);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
  console.log(`${label} selesai dan terverifikasi`);
}

function copyOrtFiles() {
  const ortDir = path.join(root, "node_modules", "onnxruntime-web");
  if (!fs.existsSync(path.join(ortDir, "package.json"))) fail('onnxruntime-web belum terpasang. Jalankan "npm install" dulu.');
  const version = JSON.parse(fs.readFileSync(path.join(ortDir, "package.json"), "utf8")).version;
  const dist = path.join(ortDir, "dist");
  const files = fs.readdirSync(dist).filter((name) => /^ort-wasm-simd-threaded.*\.(wasm|mjs)$/.test(name));
  if (files.length === 0) fail(`Tidak ada berkas ort-wasm-simd-threaded* di ${dist}.`);
  const target = path.join(outDir, "runtime", "ort", version);
  fs.mkdirSync(target, { recursive: true });
  for (const name of files) {
    const from = path.join(dist, name);
    const to = path.join(target, name);
    if (!fs.existsSync(to) || fs.statSync(to).size !== fs.statSync(from).size) fs.copyFileSync(from, to);
  }
  console.log(`onnxruntime-web ${version}: ${files.length} berkas disalin ke runtime/ort/${version}/`);
}

function copyNotices() {
  const pkg = path.join(root, "node_modules", "tilawa-v1");
  for (const [from, to] of [["NOTICE.md", "NOTICE.md"], ["LICENSE", "LICENSE.txt"]]) {
    const source = path.join(pkg, from);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(outDir, to));
      console.log(`${to} disalin dari paket tilawa-v1`);
    } else {
      console.warn(`PERINGATAN: ${from} tidak ditemukan di paket tilawa-v1; salin manual sebelum distribusi.`);
    }
  }
}

async function main() {
  const arg = process.argv.find((item) => item.startsWith("--tier="));
  const choice = arg ? arg.slice("--tier=".length) : "full";
  if (!["full", "lite", "both"].includes(choice)) fail('--tier harus "full", "lite", atau "both".');
  const tiers = choice === "both" ? ["full", "lite"] : [choice];

  console.log("Quran Hands-Free — Tilawa 1.0 self-host setup\n");
  fs.mkdirSync(outDir, { recursive: true });
  copyOrtFiles();
  for (const name of tiers) await ensureModel(name, MODELS[name]);
  copyNotices();
  console.log(
    '\nSelesai. Pakai: VITE_TILAWA_ENGINE=v1 dan VITE_TILAWA_V1_ASSETS=local di .env.local' +
      (choice === "lite" ? " beserta VITE_TILAWA_V1_TIER=lite." : "."),
  );
}

main().catch((error) => {
  console.error(`\nERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
