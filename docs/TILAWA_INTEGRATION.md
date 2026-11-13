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
- Worker menormalisasi `WorkerOutbound` Zipformer menjadi event aplikasi: `verse_match` mempertahankan `surah`, `ayah`, `verse_text`, dan `confidence`; `word_progress` mempertahankan `surah`, `ayah`, `word_index`, `total_words`, dan `matched_indices`. Menurut source `@tilawa/core` 0.4.0, `word_index` adalah posisi cursor alignment **zero-based** di dalam ayah (selalu lebih kecil dari `total_words`), bukan jumlah kata yang selesai dan bukan penanda ayat selesai. `matched_indices` dihitung terpisah: indeks zero-based kata dengan verdict `ok` atau `unsure`, terurut, dan boleh berceruk. Field khusus engine lainnya tidak diteruskan.
- Batasan semantik `word_progress` (audit `@tilawa/core` 0.4.0): `matched_indices` dihitung ulang dari alignment terbaru pada setiap event, bukan riwayat kata yang pernah benar, sehingga kata (termasuk kata terakhir) dapat keluar-masuk daftar, terutama saat pembaca mengulang. Kata terakhir ayat tidak dijamin memperoleh verdict `ok`/`unsure`. Event hanya mewakili ayat tempat cursor berada, dan cursor dapat masuk ayat berikutnya sebelum kata terakhir ayat sebelumnya dinilai. Verdict `wrong`/`skipped`/`pending` tidak diekspos oleh `WorkerOutbound` publik. Karena itu aplikasi tidak menyimpulkan perpindahan ayat dari cursor saja; lihat keputusan 2026-11-11 di `DECISIONS.md`.
- Sesi Zipformer memakai opsi publik `stayOnSurah: true`: discovery awal tetap dapat mencari seluruh Quran, tetapi setelah terkunci engine tidak akan merelokasi tracking ke surat lain. `reset()` tetap menghapus state sesi dan memulai discovery baru dengan opsi yang sama; kontrol stop/resume aplikasi menggunakan reset ini.
- Karena `stayOnSurah: true`, engine tidak pindah surat sendiri setelah terkunci. Aplikasi memanggil `TilawaAdapter.reset()` (API publik yang juga dipakai Start/Stop) saat `ReadingSession` meminta restart discovery: ketika ayat terakhir sebuah surat selesai, dan ketika basmalah terdeteksi sebagai `verse_match` 1:1 sementara sesi menunggu ayat 1 surat lain. Perilaku engine setelah `reset()` (discovery ke seluruh Quran, apakah basmalah benar-benar dikirim sebagai 1:1, kapan event `completed` terkirim) belum diverifikasi dari source upstream maupun tes nyata; lihat `NEXT_STEPS.md`.
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

---

## 6. Jalur Evaluasi Tilawa 1.0 (branch `eval/tilawa-1.0`)

Jalur ini hanya untuk **evaluasi**; default aplikasi tetap `@tilawa/core` 0.4.0 Zipformer. Pilih engine saat dev/build lewat `VITE_TILAWA_ENGINE=v1` (tanpa nilai itu, 0.4.0 yang jalan).

- **Dependensi**: `tilawa-v1` = alias npm ke `@tilawa/core@1.0.0-rc.0` (Preview, tag npm `next`), berdampingan dengan `@tilawa/core` 0.4.0. Versi `1.0.0-rc.0` dipin dari tag upstream `v1.0.0-rc.0`; **ketersediaannya di registry npm belum diverifikasi dari lingkungan pengembangan ini**.
- **File baru**: `src/workers/recognition.v1.worker.ts` (worker 1.0), `src/recognition/tilawa/v1Mapper.ts` (pemetaan event murni, tanpa import paket, diuji di `test/tilawaV1Mapper.test.ts`), `src/recognition/tilawa/TilawaV1Adapter.ts`, `src/recognition/createAdapter.ts` (pemilih engine). `TilawaAdapter` menerima pembuat worker opsional; worker 0.4.0 dan `ReadingSession` tidak diubah.
- **Perbedaan API 1.0**: sesi sekali pakai (`startFreeRecitation()`, `pushAudio(samples, 16000)`), event `position` (state `acquiring`/`locked`/`ambiguous`/`lost`, `observed[].word` dengan indeks kata **1-based**, `span`, `confidence`) dan `checker`. Tidak ada `stayOnSurah`, `raw_transcript`, maupun `verse_text`. Basmalah dan frasa (takbir, ruku', sujud, taslim, isti'adzah) ditangani tracker engine.
- **Pemetaan ke kontrak aplikasi** (`V1PositionMapper`): hanya event `locked` dengan kandidat teratas yang diteruskan. `verse_match` dikirim saat (surat, ayat) kandidat teratas berubah; `verse_text` disusun dari kata ayat di referensi `ref-v2` milik 1.0. `word_progress`: `word_index = word - 1` (zero-based), `total_words` dari referensi, `matched_indices` = kata ayat itu yang tercakup `span` sampai kata terakhir yang dibaca. Event yang tidak mengubah apa pun tidak dikirim ulang. `ambiguous`/`lost`/`acquiring` diabaikan. Event `checker` (deteksi kesalahan) belum dipakai.
- **`reset()`**: karena sesi 1.0 sekali pakai, `reset` di worker 1.0 = `dispose()` sesi lama + `startFreeRecitation()` baru + reset mapper. Model tidak dimuat ulang.
- **Aset**: model (full 68 MB / lite 25 MB, `VITE_TILAWA_V1_TIER=auto|full|lite`) diunduh dari `https://tilawa.dev/v1/` lalu disimpan di Cache API; referensi `ref-v2.json` (4,7 MB) dibundel dari paket. File WASM onnxruntime-web dimuat dari jsDelivr sesuai versi `onnxruntime-web` terpasang (default tilawa.dev hanya menyediakan satu versi). Jalur ini **butuh internet** dan memakai CDN pihak ketiga; self-hosting/offline belum dikerjakan. Provider ONNX: default Tilawa (`webgpu` lalu `wasm`), dapat dipaksa dengan `VITE_TILAWA_V1_PROVIDERS=wasm`.
- **Lisensi**: bobot model 1.0 berlisensi CC BY 4.0 (menurut model card upstream), bukan NPL-1.2; lihat `THIRD_PARTY_NOTICES.md`.
- **Belum diverifikasi** (tidak ada `npm install`/build di lingkungan pembuatan): kompilasi TypeScript dan build Vite, perilaku WebGPU/WASM di dalam worker, kecocokan segmentasi kata `ref-v2` dengan indeks kata `public/quran/content.json` (sorotan kata bisa bergeser), serta pemetaan "ayat selesai" dari `span`. Semuanya harus dicek lewat tes nyata.
