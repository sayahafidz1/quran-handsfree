# Quran Hands-Free

`quran-handsfree` adalah aplikasi independen untuk pengalaman membaca dan melantunkan Al-Qur'an secara hands-free (tanpa tangan).

Proyek ini merupakan **produk terpisah** dari repository `tilawa`. Engine pengenalan Al-Qur'an upstream (`yazinsai/tilawa`) digunakan murni sebagai recognition engine tanpa memodifikasi source upstream tersebut.

> **Attribution:** Quran recognition powered by Tilawa. Lihat [THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).

## Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

Pihak ketiga yang digunakan, termasuk `@tilawa/core`, memiliki atribusi dan lisensi yang dicatat dalam [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).

---

## Struktur Proyek

```text
quran-handsfree/
├── src/
│   ├── app/                 # Bootstrapping, orkestrasi, state machine sesi, bookmark (localStorage)
│   │   └── reading/         # ReadingSession dan state machine bacaan
│   ├── audio/               # Audio capture & resampler 16 kHz Mono Float32
│   ├── quran/               # Offline Quran content, metadata, and navigation
│   ├── recognition/         # Abstraksi & kontrak pengenalan suara
│   │   └── tilawa/          # Adapter & boundary integrasi @tilawa/core
│   ├── workers/             # Web Worker untuk inferensi ONNX & Tilawa Session
│   ├── ui/                  # Presentasi & styling antarmuka
│   ├── main.ts              # Entry point utama aplikasi
│   └── vite-env.d.ts        # Type declarations lingkungan Vite
├── public/
│   ├── manifest.webmanifest # Konfigurasi PWA Web Manifest
│   ├── sw.js                # Service worker untuk caching offline
│   ├── quran/content.json   # Asset teks Quran offline (114 surah)
│   └── tilawa/              # Folder aset runtime Tilawa (dipin/checksum)
├── docs/
│   ├── ARCHITECTURE.md      # Detail arsitektur & pemisahan layer
│   ├── DECISIONS.md         # Catatan keputusan arsitektur (ADR)
│   ├── GOALS.md             # Tujuan produk, batasan, & backlog
│   ├── NEXT_STEPS.md        # Roadmap & langkah pengembangan berikutnya
│   ├── PROJECT_CONTEXT.md   # Konteks hidup proyek untuk kolaborasi agent/engineer
│   ├── THIRD_PARTY_NOTICES.md # Lisensi & atribusi pihak ketiga
│   └── TILAWA_INTEGRATION.md  # Spesifikasi teknis integrasi Tilawa
├── AGENTS.md                # Panduan & batasan kerja bagi agent pengembang
├── package.json             # Dependensi aplikasi (@tilawa/core, onnxruntime-web)
├── tsconfig.json            # Konfigurasi TypeScript
├── vite.config.ts           # Konfigurasi Vite bundler & Worker
└── README.md                # Dokumentasi utama proyek
```

`src/quran/content/` menyediakan surah, juz, ayah, teks Arab, dan indeks kata
stabil melalui `OfflineQuranContentProvider`. Provider ini tidak memiliki
reading state dan tidak mengimpor internal recognition engine. Asset
`public/quran/content.json` dicache oleh service worker untuk penggunaan
offline. Service worker (`public/sw.js`) memuat halaman dengan jaringan dulu (versi baru langsung terlihat setelah deploy) dan memakai cache hanya sebagai cadangan offline; aset berhash memakai cache dulu dan tidak pernah menyimpan jawaban HTML untuk permintaan aset.

---

## Batas Integrasi (Integration Boundary)

- **`src/recognition/tilawa/`**: Berfungsi sebagai boundary/adapter antara kontrak aplikasi dan paket publik `@tilawa/core`.
- **Pemisahan Product Logic**: Alur logika produk di masa depan (seperti `discovery -> lock -> verify -> next ayah`) **tidak boleh dicampur** ke dalam adapter Tilawa. Adapter hanya bertugas memetakan stream audio ke session Tilawa dan meneruskan event pengenalan.
- **Reading Session**: `src/app/reading/ReadingSession.ts` adalah satu-satunya konsumen event Tilawa di application layer dan mengelola state `idle`, `discovering`, `locked`, `tracking`, `expecting_next`, `mismatch`, serta `completed` dari event publik `verse_match` dan `word_progress`.
- **Navigasi Perintah**: Hasil parsing perintah teks maupun suara langsung memulai atau memindahkan target `ReadingSession`; state navigasi dan discovery tidak memiliki coordinator legacy terpisah.
- **Direct Recitation Discovery**: `verse_match` dapat memulai sesi dan mengunci ayat yang ditemukan saat belum ada pilihan manual; pilihan manual tetap menjadi target yang harus dicocokkan.
- **Isolasi Engine**: Jangan mengimpor source internal Tilawa atau menduplikasi kodenya jika API publik `@tilawa/core` mencukupi.
- **Portabilitas**: Desain arsitektur ini memungkinkan aplikasi berjalan sebagai Web/PWA saat ini dan dapat diadopsi ke React Native/Android nanti dengan mengganti adapter platform tanpa merusak product logic inti.

---

## Menjalankan Aplikasi

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Penyiapan Aset Runtime Tilawa
Jalankan setup otomatis yang mengambil aset dari Tilawa release resmi ke `public/tilawa/`:
```bash
npm run setup
```

Script setup akan memeriksa ukuran dan SHA-256, lalu mengunduh ulang aset
Zipformer yang belum ada atau tidak valid:
- `zipformer_a0w_ep1_a05.int8.onnx` dan `zipformer_a0w_ep1_a05.io.json`
- `zipformer_quran.json`
- `quran.json` (opsional untuk teks pada event Tilawa)
- `NPL-1.2.txt`

Model dipin ke Tilawa `zipformer-a0w-ep1-a0.5`, korpus fonem ke `v0.3.0`, dan
teks display ke `v0.2.0`. Untuk fresh clone, jalankan `npm run setup` setelah
`npm install`; setup dapat dijalankan ulang dengan aman. Model dan korpus
Zipformer berlisensi NPL-1.2 (non-komersial/share-alike), bukan MIT.

### 2b. (Opsional) Evaluasi Tilawa 1.0
Hanya di branch `eval/tilawa-1.0`. Jalankan `npm install`, buat file `.env.local` di folder proyek (tidak ikut Git) berisi:
```text
VITE_TILAWA_ENGINE=v1
```
lalu `npm run dev`. Hapus file itu (atau isinya) untuk kembali ke engine 0.4.0, yang menjadi default. Secara bawaan jalur 1.0 mengunduh model dari internet (lihat `docs/TILAWA_INTEGRATION.md` bagian 6).

**Tanpa internet (self-host):** jalankan `npm run setup:v1` (mengunduh model 68 MB dan menyalin file WASM ke `public/tilawa-v1/`), tambahkan `VITE_TILAWA_V1_ASSETS=local` ke `.env.local`, lalu `npm run preview:local`. Detail dan batasannya di `docs/TILAWA_INTEGRATION.md` bagian 7. Atribusi CC BY 4.0: `docs/THIRD_PARTY_NOTICES.md` bagian 4.

### 3. Menjalankan Server Development
```bash
npm run dev
```

Untuk diagnostik pengenalan, buat `.env.local` di root proyek dengan
`VITE_DEBUG_RECOGNITION=true`, mulai ulang server, lalu buka Developer Tools >
Console dan coba perintah suara. Log `[VOICE_COMMAND]` melacak permintaan
mulai, audio/suara/bicara terdeteksi, hasil transkrip, hasil parsing, error
browser, serta penerimaan hasil oleh aplikasi. Log transkrip berisi ucapan Anda;
aktifkan hanya saat debug dan hapus/nonaktifkan flag setelah selesai. Log
`[ZIPFORMER_IO]` mencatat setiap balikan Zipformer beserta indeks chunk yang
memicunya dan hasil normalisasi. Teks `raw_transcript` dicatat lengkap;
`transcriptDelta` menunjukkan perubahan sejak balikan sebelumnya dan
`transcriptRevised` menandai koreksi. Audio tetap diproses apa adanya,
termasuk saat hening.
`[READING_SESSION]` mencatat perubahan state setelah event diterima. Log dapat
berisi teks lantunan; aktifkan hanya saat debug dan nonaktifkan flag setelah
selesai. Diagnostik hanya aktif saat development; build produksi selalu
menonaktifkannya.

### 4. Membangun untuk Produksi
```bash
npm run build
```

### 5. Deploy ke Cloudflare
Konfigurasi Wrangler tersedia di `wrangler.jsonc`. Gunakan perintah berikut untuk
build sekaligus menjalankan preview atau deploy ke Cloudflare:

```bash
npm run preview
npm run deploy
```

**Versi yang sudah berjalan:** https://quran-handsfree.sudirmanhafidz1.workers.dev (Cloudflare Workers, terhubung ke GitHub: setiap push ke `main` otomatis build dan deploy; build yang gagal tidak menimpa situs yang sedang hidup).

Cara kerja deploy otomatis:
- Build command di dashboard Cloudflare: `npm run build && rm -f dist/assets/ort-wasm-simd-threaded.jsep-*.wasm`. File WebGPU (sekitar 26,5 MiB) dihapus karena Workers Static Assets membatasi satu berkas hingga 25 MiB dan aplikasi tidak memakainya.
- Variabel `VITE_*` (misalnya `VITE_TILAWA_ENGINE=v1`) ditanam saat build; ubah di dashboard Cloudflare, bukan di `.env.local`.
- Model tidak ikut di situs. Mode `remote` mengunduh model dari tilawa.dev dan WASM dari jsDelivr: **pada pembukaan pertama di sebuah perangkat, model harus diunduh dulu (sekitar 68 MB `full`, atau 25 MB `lite` bila memori perangkat kurang)**, dengan popup pemuatan. Setelah itu model diambil dari cache perangkat, termasuk saat tanpa internet.
- Jangan menjalankan `npm run preview` atau `npm run deploy` (Wrangler) saat `public/tilawa-v1/` berisi model hasil `npm run setup:v1`; berkas model 68 MB melewati batas 25 MiB. Untuk uji tanpa internet di komputer pakai `npm run preview:local`.
- Evaluasi R2 (belum dikerjakan): lihat catatan di `docs/TILAWA_INTEGRATION.md` bagian 6.

---

## Dokumentasi Lengkap

Untuk memahami konteks teknis dan arsitektur lebih dalam:
1. [AGENTS.md](AGENTS.md) — Panduan kerja dan batasan mutlak pengembang.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Diagram arsitektur dan prinsip modularitas.
3. [docs/GOALS.md](docs/GOALS.md) — Visi produk dan fitur backlog.
4. [docs/TILAWA_INTEGRATION.md](docs/TILAWA_INTEGRATION.md) — Panduan integrasi teknis engine Tilawa.
5. [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) — Konteks status dan panduan kelanjutan proyek.

