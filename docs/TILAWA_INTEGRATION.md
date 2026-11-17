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

## 6. Jalur Tilawa 1.0

Jalur ini masih tahap **evaluasi**; default aplikasi tetap `@tilawa/core` 0.4.0 Zipformer. Pilih engine saat dev/build lewat `VITE_TILAWA_ENGINE=v1` (tanpa nilai itu, 0.4.0 yang jalan).

- **Dependensi**: `tilawa-v1` = alias npm ke `@tilawa/core@1.0.0-rc.0` (Preview, tag npm `next`), berdampingan dengan `@tilawa/core` 0.4.0. Versi `1.0.0-rc.0` dipin dari tag upstream `v1.0.0-rc.0`. Ketersediaannya di registry npm terverifikasi pada 2026-11-17: `npm install`, `tsc --noEmit`, dan `npm run build` lolos di komputer pemilik proyek, dan `package-lock.json` di `main` memuat `tilawa-v1`.
- **File baru**: `src/workers/recognition.v1.worker.ts` (worker 1.0), `src/recognition/tilawa/v1Mapper.ts` (pemetaan event murni, tanpa import paket, diuji di `test/tilawaV1Mapper.test.ts`), `src/recognition/tilawa/TilawaV1Adapter.ts`, `src/recognition/createAdapter.ts` (pemilih engine). `TilawaAdapter` menerima pembuat worker opsional; worker 0.4.0 dan `ReadingSession` tidak diubah.
- **Perbedaan API 1.0**: sesi sekali pakai (`startFreeRecitation()`, `pushAudio(samples, 16000)`), event `position` (state `acquiring`/`locked`/`ambiguous`/`lost`, `observed[].word` dengan indeks kata **1-based**, `span`, `confidence`) dan `checker`. Tidak ada `stayOnSurah`, `raw_transcript`, maupun `verse_text`. Basmalah dan frasa (takbir, ruku', sujud, taslim, isti'adzah) ditangani tracker engine.
- **Pemetaan ke kontrak aplikasi** (`V1PositionMapper`): hanya event `locked` dengan kandidat teratas yang diteruskan. `verse_match` dikirim saat (surat, ayat) kandidat teratas berubah; `verse_text` disusun dari kata ayat di referensi `ref-v2` milik 1.0. `word_progress`: `word_index = word - 1` (zero-based), `total_words` dari referensi, `matched_indices` = kata ayat itu yang tercakup `span` sampai kata terakhir yang dibaca. Event yang tidak mengubah apa pun tidak dikirim ulang. `verse_match` diberi `basmala: true` bila kandidat teratas membawa `prefix: "basmala"` (dipakai `ReadingSession` untuk membuka pencarian baru). `ambiguous`/`lost`/`acquiring` diabaikan. Event `checker` (deteksi kesalahan) belum dipakai.
- **`reset()`**: karena sesi 1.0 sekali pakai, `reset` di worker 1.0 = `dispose()` sesi lama + `startFreeRecitation()` baru + reset mapper. Model tidak dimuat ulang.
- **Aset**: model (full 68 MB / lite 25 MB, `VITE_TILAWA_V1_TIER=auto|full|lite`) diunduh dari `https://tilawa.dev/v1/` lalu disimpan di Cache API; referensi `ref-v2.json` (4,7 MB) dibundel dari paket. File WASM onnxruntime-web dimuat dari jsDelivr sesuai versi `onnxruntime-web` terpasang (default tilawa.dev hanya menyediakan satu versi). Ini mode `remote` (bawaan): **butuh internet** dan memakai CDN pihak ketiga. Mode `local` ada di bagian 7. Provider ONNX: default Tilawa (`webgpu` lalu `wasm`), dapat dipaksa dengan `VITE_TILAWA_V1_PROVIDERS=wasm`.
- **Cadangan model ringan (mode `remote`)**: kalau memuat model gagal dengan tier `full`/`auto` (misalnya memori ponsel kurang: "failed to allocate a buffer of size 67759744"), worker otomatis mencoba tier `lite` tanpa tindakan pengguna dan menampilkan pesan status; layar error baru muncul bila `lite` juga gagal (pesan memuat kedua penyebab). Logikanya `fallbackTier()` di `v1Assets.ts` (diuji di `test/tilawaV1Assets.test.ts`). Setelah cadangan `lite` berhasil, worker menyimpan penanda "pakai lite" di Cache API (cache `tilawa-v1-prefs`, terpisah dari berkas model dan tidak disentuh service worker); peluncuran berikutnya langsung memuat `lite` lewat `chooseStartTier()`. Menghapus data situs di browser menghapus penanda itu. Mode `local` tidak punya cadangan karena `setup:v1` hanya mengunduh model `full`. Ketepatan `lite` belum diukur; pengguna di ponsel lemah bisa mendapat ketepatan lebih rendah.
- **Lisensi**: bobot model 1.0 berlisensi CC BY 4.0 (menurut model card upstream), bukan NPL-1.2; lihat `THIRD_PARTY_NOTICES.md`.
- **Deploy Cloudflare (mode `remote`)**: Cloudflare Workers menolak aset di atas 25 MiB, sedangkan `onnxruntime-web/all` membuat Vite menaruh `ort-wasm-simd-threaded.jsep-*.wasm` (26,5 MiB) di `dist/assets/`. Karena mode `remote` memuat WASM dari jsDelivr, file itu dibuang lewat Build command di dashboard Cloudflare: `npm run build && rm -f dist/assets/ort-wasm-simd-threaded.jsep-*.wasm`. Variabel build diisi di dashboard (bukan `.env.local`, yang tidak ada di Git): `VITE_TILAWA_ENGINE=v1`, `VITE_TILAWA_V1_TIER=full`, `VITE_TILAWA_V1_PROVIDERS=wasm`; `VITE_TILAWA_V1_ASSETS` dibiarkan kosong dan jangan diisi `local` di sana. Deploy sukses pada 2026-11-17 (alamat `https://quran-handsfree.sudirmanhafidz1.workers.dev`). Konfigurasi ini hanya ada di dashboard; lihat `DECISIONS.md` 2026-11-17.
- **Sudah terverifikasi** (2026-11-17, di komputer pemilik proyek): kompilasi TypeScript (`tsc --noEmit`) dan build Vite lolos, dan build Cloudflare berhasil.
- **Belum diverifikasi**: tes nyata di ponsel (unduhan model, mikrofon, bacaan) pada alamat Cloudflare, perilaku WebGPU/WASM di dalam worker, kecocokan segmentasi kata `ref-v2` dengan indeks kata `public/quran/content.json` (sorotan kata bisa bergeser), serta pemetaan "ayat selesai" dari `span`. Semuanya harus dicek lewat tes nyata.

---

## 7. Self-host Tilawa 1.0 (mode `local`, tanpa internet)

Tujuan akhir aplikasi adalah APK yang berjalan tanpa internet, jadi semua file 1.0 harus berasal dari aplikasi sendiri. Mode ini dipilih dengan `VITE_TILAWA_V1_ASSETS=local` (bersama `VITE_TILAWA_ENGINE=v1`); tanpa itu mode `remote` (bagian 6) tetap bawaan.

- **Siapkan file**: `npm install` lalu `npm run setup:v1` mengisi `public/tilawa-v1/` (tidak ikut Git, kecuali `ATTRIBUTION.txt`) dengan layout yang sama seperti `https://tilawa.dev/v1/`: `models/spliced-clean/1-int8/model.onnx` (full, 67.759.744 byte), file `ort-wasm-simd-threaded*` dari `node_modules/onnxruntime-web/dist/` ke `runtime/ort/<versi>/` (versi yang sama dengan yang terpasang, sehingga cocok dengan jalur bawaan SDK), serta `NOTICE.md` dan `LICENSE.txt` dari paket `tilawa-v1`. `-- --tier=lite` atau `-- --tier=both` memilih model lite (24.650.054 byte). Ukuran dan SHA-256 model dipin di `scripts/setup-tilawa-v1.mjs`, diambil dari `MODEL_REGISTRY` paket 1.0.0-rc.0; file yang tidak cocok dibuang.
- **Di worker**: `createTilawa({ assetBase: <origin><BASE_URL>tilawa-v1/, reference, tier, providers, storage })`. Model, WASM, dan referensi tidak diminta ke situs lain. `tier` di mode lokal bawaannya `full` (bukan `auto`, agar SDK tidak memilih model yang tidak diunduh); ubah dengan `VITE_TILAWA_V1_TIER=lite`. `storage` adalah penyimpanan di memori (`createMemoryStorage`): model tidak ditulis ke Cache API, sehingga jendela incognito berperilaku sama dengan biasa dan tidak bergantung pada cache; konsekuensinya model dibaca dari server aplikasi setiap sesi dimuat. Logika pemilihan mode/tier/alamat ada di `src/recognition/tilawa/v1Assets.ts` (murni, diuji di `test/tilawaV1Assets.test.ts`).
- **Service worker**: `public/sw.js` tidak men-cache apa pun di `/tilawa-v1/` (versi cache menjadi `v3`), agar model 68 MB tidak tersimpan dua kali.
- **Pratinjau lokal**: gunakan `npm run preview:local` (`vite preview`). `npm run preview` dan `npm run deploy` memakai Wrangler yang membatasi sekitar 25 MiB per aset, sehingga **jangan menjalankannya selama `public/tilawa-v1/` berisi model**. Deploy Cloudflare tetap memakai mode `remote`.
- **Pemeriksaan SDK**: saat memuat, SDK memeriksa ukuran dan SHA-256 model terhadap registry bawaannya. Pada halaman `http` biasa tanpa WebCrypto (bukan `localhost`/`https`), SHA-256 dilewati dan hanya ukuran yang diperiksa.
- **Atribusi**: lihat `THIRD_PARTY_NOTICES.md` bagian 4; ditampilkan di layar "Tentang & Lisensi" dan `public/tilawa-v1/ATTRIBUTION.txt`.
- **Belum diverifikasi** (tidak ada `npm install`, `tsc`, build, atau unduhan dari `tilawa.dev` di lingkungan pembuatan): skrip `setup:v1` belum pernah dijalankan (checksum disalin dari registry paket, bukan dihitung dari file); nama file `ort-wasm-simd-threaded*` yang benar-benar dibutuhkan jalur WebGPU/WASM; pemuatan modul `.mjs` ONNX Runtime dari `public/` oleh dev server Vite; serta perilaku di WebView APK. Uji: `npm run setup:v1`, `npm run build`, `npm run preview:local`, putus internet, buka jendela incognito, dan pastikan tab Network tidak memuat apa pun dari domain lain.
