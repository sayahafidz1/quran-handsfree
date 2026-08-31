# Catatan Keputusan Arsitektur (Architecture Decision Records)

## 2026-08-24 — Pemisahan Produk Aplikasi dan Engine Upstream
- **Konteks**: Diperlukan aplikasi Quran Hands-Free yang memanfaatkan kemampuan pengenalan Tilawa.
- **Keputusan**: `quran-handsfree` dibuat sebagai proyek terpisah. Folder clone upstream `../tilawa` tidak dimodifikasi sama sekali.
- **Konsekuensi**: Upgrade engine upstream di masa depan tetap bersih dan pengelolaan lisensi/atribusi jelas.

## 2026-08-24 — Web/PWA & Inferensi di Web Worker
- **Konteks**: Pengenalan audio harus berjalan lokal di perangkat pengguna tanpa membuat antarmuka macet (*UI freeze*).
- **Keputusan**: Menggunakan `@tilawa/core` + `onnxruntime-web` (WASM) yang dieksekusi di dalam Web Worker terpisah. Audio dikonversi ke mono Float32 16 kHz.
- **Konsekuensi**: Kinerja UI tetap lancar 60fps saat inferensi berlangsung.

## 2026-08-24 — Aset Model Dipin & Diabaikan oleh Git
- **Konteks**: Berkas model ONNX (~88 MB) dan JSON kosakata berukuran besar tidak cocok disimpan di version control Git.
- **Keputusan**: Folder `public/tilawa/` menyimpan aset runtime lokal dan didaftarkan di `.gitignore`. Aset dipin versinya dan diverifikasi dengan checksum SHA-256.
- **Konsekuensi**: Ukuran repository tetap ramping dan proses upgrade aset terkontrol dengan aman.

## 2026-08-28 — Penyempurnaan Struktur Modular & Batas Integrasi Tilawa
- **Konteks**: Memastikan arsitektur proyek rapi, terisolasi, dan siap dikembangkan lintas platform tanpa mengaburkan batas antara recognition engine dan domain logic produk.
- **Keputusan**:
  1. Merapikan struktur folder menjadi:
     - `src/app/`: bootstrap dan orkestrasi aplikasi.
     - `src/audio/`: penangkapan audio & resampling.
     - `src/recognition/`: kontrak umum pengenalan suara.
     - `src/recognition/tilawa/`: adapter isolasi untuk `@tilawa/core`.
     - `src/workers/`: background worker untuk eksekusi session ONNX.
     - `src/ui/`: presentasi dan styling antarmuka.
  2. Menegaskan bahwa product logic di masa depan (`discovery -> lock -> verify -> next ayah`) tidak boleh masuk ke dalam `src/recognition/tilawa/`.
  3. Mengonsumsi `@tilawa/core` murni melalui public package API tanpa menyalin source atau mengimpor internal file.
  4. Menunda fitur produk seperti verifier, voice command, dan antarmuka mushaf ke backlog iterasi berikutnya.
- **Konsekuensi**: Arsitektur menjadi sangat terstruktur (*loose coupling*), mudah diuji, dan portabel untuk platform Android nantinya.

## 2026-08-28 — Navigasi Surat dan Ayat Berada di Boundary Produk
- **Konteks**: Pengguna perlu menentukan posisi awal bacaan tanpa melantunkan ayat terlebih dahulu.
- **Keputusan**: Parsing perintah, validasi 114 surat/nomor ayat, dan penguncian anchor ditempatkan di `src/command/` serta `src/quran/`; Tilawa tetap terbatas pada discovery bacaan.
- **Konsekuensi**: `VoiceCommandRecognizer` dapat diganti dengan STT on-device di masa depan tanpa mengubah parser, validator, coordinator, atau source upstream Tilawa.
