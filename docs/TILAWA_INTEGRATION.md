# Integrasi Engine Tilawa (Tilawa Integration)

Dokumen ini menjelaskan batas integrasi teknis antara aplikasi `quran-handsfree` dan engine pengenalan suara `@tilawa/core`.

---

## 1. Dependensi & Atribusi
- **Core Engine**: `@tilawa/core` (versi dipin di `package.json`).
- **ONNX Web Runtime**: `onnxruntime-web` (menggunakan provider WASM SIMD single-thread).
- Vite mengecualikan `onnxruntime-web` dari dependency pre-bundling. Worker menetapkan `ort.env.wasm.wasmPaths` ke URL aset yang diimpor dengan `?url`, sehingga dev dan production memakai file WASM paket yang benar, bukan URL cache `.vite/deps`.
- Service worker tidak meng-cache modul internal Vite; saat cache berubah versi, cache lama aplikasi dihapus. Setelah perubahan, muat ulang halaman dengan hard refresh agar worker terbaru aktif.
- **Clone Upstream**: `../tilawa/` (hanya boleh dibaca sebagai referensi upstream; tidak boleh dimodifikasi).

---

## 2. Batas Integrasi (`src/recognition/tilawa/`)

Seluruh komunikasi dengan `@tilawa/core` diisolasi di folder `src/recognition/tilawa/`:
- `TilawaAdapter.ts`: Mengelola siklus hidup Web Worker (`src/workers/recognition.worker.ts`), mengirim audio chunk 16 kHz Float32, dan menerjemahkan output worker menjadi `RecognitionEvent`.
- `types.ts`: Mendefinisikan pesan komunikasi antar-thread (`TilawaWorkerCommand`, `TilawaWorkerResponse`).
- Worker menormalisasi `WorkerOutbound` Zipformer menjadi event aplikasi: `verse_match` mempertahankan `surah`, `ayah`, `verse_text`, dan `confidence`; `word_progress` mempertahankan `surah`, `ayah`, `word_index` (one-based), dan `total_words`. Field khusus engine tidak diteruskan.
- Sesi Zipformer memakai opsi publik `stayOnSurah: true`: discovery awal tetap dapat mencari seluruh Quran, tetapi setelah terkunci engine tidak akan merelokasi tracking ke surat lain. `reset()` tetap menghapus state sesi dan memulai discovery baru dengan opsi yang sama; kontrol stop/resume aplikasi menggunakan reset ini.
- Diagnostik migration berada di worker dan bootstrap aplikasi, bukan di business logic. Saat development, `VITE_DEBUG_RECOGNITION=true` menampilkan inisialisasi/status Zipformer, ayat dan confidence terdeteksi, progress kata, serta transisi/snapshot `ReadingSession`. Log tidak menyertakan teks lantunan dan tidak mencatat setiap audio chunk. Secara default log mati; production build selalu menonaktifkannya.

> **PENTING**: Alur logika produk (seperti state machine *discovery -> lock -> verify -> next ayah*) tidak boleh diletakkan di dalam adapter ini.

---

## 3. Aset Runtime Zipformer (`public/tilawa/`)

`npm run setup` mengunduh dan memverifikasi aset runtime berikut. `@tilawa/core`
0.4.0 menetapkan `zipformer-a0w-ep1-a0.5` sebagai model default; rilis model
tersebut menyatakan korpus fonem `zipformer_quran.json` dari v0.3.0 tetap
kompatibel. Teks `quran.json` hanya dipakai untuk mengisi teks pada event
`verse_match` dan bersifat opsional bagi engine. SHA-256 lengkap dicatat bersama
prosedur setup di [`public/tilawa/README.md`](../public/tilawa/README.md).

| Berkas | Rilis sumber | Kegunaan |
| --- | --- | --- |
| `zipformer_a0w_ep1_a05.int8.onnx` | `zipformer-a0w-ep1-a0.5` | Model Zipformer2-CTC default untuk core 0.4.0 |
| `zipformer_a0w_ep1_a05.io.json` | `zipformer-a0w-ep1-a0.5` | I/O model (core 0.4.0 juga menyertakan manifest default) |
| `zipformer_quran.json` | `v0.3.0` | Korpus fonem Zipformer |
| `quran.json` | `v0.2.0` | Teks Quran opsional untuk event recognition |
| `NPL-1.2.txt` | `v0.3.0` | Lisensi model dan korpus Zipformer |

FastConformer `vocab.json`, `quran_ctc_tokens.json`, `fastconformer_full_mixed.onnx`,
dan `export_metadata.json` tidak diperlukan oleh jalur Zipformer. Jangan
mencampur korpus FastConformer dengan korpus fonem Zipformer. Model dan korpus
Zipformer tunduk pada NPL-1.2, bukan MIT; lihat
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) sebelum distribusi.

---

## 4. Kontrak Format Audio

- **Sample Rate**: Wajib `16,000 Hz` (16 kHz).
- **Channel**: Mono (`1 channel`).
- **Tipe Data**: `Float32Array` (range amplitudo -1.0 hingga +1.0).
- Resampling ditangani oleh `src/audio/MicrophoneCapture.ts`.

---

## 5. Prosedur Pembaruan (Upgrade) Engine
1. Perbarui versi `@tilawa/core` di `package.json`.
2. Pilih rilis model dan korpus yang dinyatakan kompatibel oleh upstream.
3. Perbarui sumber dan checksum pin di `scripts/setup-tilawa.mjs` serta tabel
   aset di `public/tilawa/README.md`.
4. Jalankan `npm run setup`, `npm run build`, dan uji event recognition.
5. Tinjau lisensi aset serta perbarui `docs/THIRD_PARTY_NOTICES.md` bila berubah.
