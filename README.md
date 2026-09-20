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
│   ├── app/                 # Bootstrapping, orkestrasi, & state machine sesi
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
offline.

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

Script setup akan memeriksa dan mengunduh ulang aset yang belum ada atau tidak valid:
- `fastconformer_full_mixed.onnx`
- `vocab.json`
- `quran_ctc_tokens.json`
- `quran.json`
- `export_metadata.json`

Aset yang digunakan dipin ke Tilawa release `v0.2.0`. Untuk fresh clone, jalankan `npm run setup` setelah `npm install`; setup dapat dijalankan ulang dengan aman.

### 3. Menjalankan Server Development
```bash
npm run dev
```

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

Catatan: Cloudflare Workers Static Assets membatasi satu berkas hingga 25 MiB.
Model Tilawa `fastconformer_full_mixed.onnx` berukuran sekitar 84 MiB, sehingga
deploy penuh memerlukan hosting model terpisah (misalnya R2) sebelum fitur
recognition dapat dipublikasikan melalui Cloudflare.

---

## Dokumentasi Lengkap

Untuk memahami konteks teknis dan arsitektur lebih dalam:
1. [AGENTS.md](AGENTS.md) — Panduan kerja dan batasan mutlak pengembang.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Diagram arsitektur dan prinsip modularitas.
3. [docs/GOALS.md](docs/GOALS.md) — Visi produk dan fitur backlog.
4. [docs/TILAWA_INTEGRATION.md](docs/TILAWA_INTEGRATION.md) — Panduan integrasi teknis engine Tilawa.
5. [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) — Konteks status dan panduan kelanjutan proyek.
