# Integrasi Engine Tilawa (Tilawa Integration)

Dokumen ini menjelaskan batas integrasi teknis antara aplikasi `quran-handsfree` dan engine pengenalan suara `@tilawa/core`.

---

## 1. Dependensi & Atribusi
- **Core Engine**: `@tilawa/core` (versi dipin di `package.json`).
- **ONNX Web Runtime**: `onnxruntime-web` (menggunakan provider WASM SIMD single-thread).
- **Clone Upstream**: `../tilawa/` (hanya boleh dibaca sebagai referensi upstream; tidak boleh dimodifikasi).

---

## 2. Batas Integrasi (`src/recognition/tilawa/`)

Seluruh komunikasi dengan `@tilawa/core` diisolasi di folder `src/recognition/tilawa/`:
- `TilawaAdapter.ts`: Mengelola siklus hidup Web Worker (`src/workers/recognition.worker.ts`), mengirim audio chunk 16 kHz Float32, dan menerjemahkan output worker menjadi `RecognitionEvent`.
- `types.ts`: Mendefinisikan pesan komunikasi antar-thread (`TilawaWorkerCommand`, `TilawaWorkerResponse`).

> **PENTING**: Alur logika produk (seperti state machine *discovery -> lock -> verify -> next ayah*) tidak boleh diletakkan di dalam adapter ini.

---

## 3. Kebutuhan Aset Runtime (`public/tilawa/`)

Aset berikut dibutuhkan untuk inferensi offline dan ditempatkan pada direktori `public/tilawa/`:

| Berkas | Fungsi |
| --- | --- |
| `fastconformer_full_mixed.onnx` | Model inferensi FastConformer ONNX (~88 MB) |
| `vocab.json` | Pemetaan vocabulary token CTC |
| `quran_ctc_tokens.json` | Indeks token CTC Quran |
| `quran.json` | Dataset teks dan referensi ayat Al-Qur'an |
| `export_metadata.json` | Metadata rilis & nilai checksum SHA-256 |

Setiap aset wajib berasal dari rilis resmi Tilawa yang identik. Jangan mencampur aset antar-rilis yang berbeda.

---

## 4. Kontrak Format Audio

- **Sample Rate**: Wajib `16,000 Hz` (16 kHz).
- **Channel**: Mono (`1 channel`).
- **Tipe Data**: `Float32Array` (range amplitudo -1.0 hingga +1.0).
- Resampling ditangani oleh `src/audio/MicrophoneCapture.ts`.

---

## 5. Prosedur Pembaruan (Upgrade) Engine
1. Perbarui versi `@tilawa/core` di `package.json`.
2. Unduh aset model & file JSON baru yang bersesuaian ke `public/tilawa/`.
3. Verifikasi checksum SHA-256 seluruh berkas aset.
4. Jalankan `npm run build` dan uji respon event `verse_match` serta `word_progress`.
5. Perbarui `docs/TILAWA_INTEGRATION.md`, `docs/DECISIONS.md`, dan `docs/THIRD_PARTY_NOTICES.md` bila terdapat perubahan lisensi atau metadata.
