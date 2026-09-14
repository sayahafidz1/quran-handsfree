# Konteks Hidup Proyek (Project Context)

Dokumen ini mencatat status terkini, batasan mutlak, serta panduan bagi engineer atau agent yang melanjutkan pekerjaan pada proyek `quran-handsfree`.

---

## 1. Status Terkini (Per 2026-09-14)

- **Struktur Folder Modular**: Telah diselaraskan menjadi `src/app/`, `src/app/reading/`, `src/audio/`, `src/recognition/tilawa/`, `src/workers/`, dan `src/ui/`.
- **Batas Integrasi**: `src/recognition/tilawa/TilawaAdapter.ts` bertindak sebagai adapter isolasi ke `@tilawa/core`.
- **Kompilasi & Build**: TypeScript checking (`tsc --noEmit`) dan Vite bundle build (`npm run build`) berjalan bersih tanpa error.
- **Service Worker & PWA**: Scaffold dasar service worker cache-first dan Web Manifest sudah terkonfigurasi.
- **Aset Model**: Aset biner dan dataset besar belum dimasukkan ke repo (dikelola via `public/tilawa/`).
- **State Machine Sesi**: `ReadingSession` di `src/app/reading/` adalah satu-satunya pemilik expected verse, detected verse, verse match, dan word progress, serta mengelola discovery, lock, tracking, expected next, mismatch, dan completed dari event `verse_match`/`word_progress`. Saat mismatch terjadi pada expected-next, target tersebut dipertahankan; pengulangan ayat aktif maupun ayat yang dilompati tidak dapat memajukan sesi, dan deteksi expected-next berikutnya memulihkan tracking.
- **Navigasi Ayat**: `src/quran/navigation.ts` menyediakan `getNextVerse()` untuk perpindahan dalam surat, lintas batas surat, dan penanda selesai setelah ayat 114:6.
- **Navigasi Command Langsung**: Hasil parser teks maupun voice langsung memulai atau memindahkan `ReadingSession`; seluruh event recognition juga hanya dikonsumsi oleh `ReadingSession`.
- **Checkpoint A.5**: Final architecture review completed: all application reading state is owned by `ReadingSession`, `AnchorCoordinator` has no runtime dependency, command and direct-recitation flows are covered by regression tests, and the production build passes. Checkpoint closure remains subject to parent issue acceptance.

---

## 2. Batasan Mutlak Proyek (Invariants)

1. **`../tilawa/` Tidak Boleh Diubah**: Repository upstream tersebut hanya klon referensi.
2. **`quran-handsfree/` Adalah Produk Terpisah**: Semua pengembangan fitur produk dilakukan di sini.
3. **Public API Only**: Konsumsi `@tilawa/core` via paket npm; jangan pernah mengimpor file internal atau menyalin source Tilawa.
4. **Isolasi Logika Produk**: Logika bisnis produk di masa depan (`discovery -> lock -> verify -> next ayah`) harus ditempatkan di domain/app layer, bukan di dalam adapter Tilawa.
5. **Portabilitas Multi-Platform**: Pertahankan abstraksi `RecognitionAdapter` agar siap diadopsi ke React Native/Android di kemudian hari.
6. **Aset Ber-Checksum**: Seluruh aset model di `public/tilawa/` wajib dipin versinya dan diverifikasi hash SHA-256.
7. **Pemisahan State Bacaan**: `ReadingSession` menyimpan seluruh state reading yang otoritatif dan menjadi satu-satunya pemilik state navigasi bacaan.

---

## 3. Panduan Melanjutkan Pekerjaan

1. Pastikan selalu membaca `AGENTS.md`, `docs/ARCHITECTURE.md`, dan `docs/GOALS.md` sebelum memulai tugas baru.
2. Untuk menguji coba inferensi pengenalan, siapkan aset Tilawa di `public/tilawa/` mengikuti panduan [public/tilawa/README.md](../public/tilawa/README.md).
3. Jalankan `npm run dev` untuk server pengujian lokal di browser.
4. Setiap penambahan fitur atau modifikasi arsitektur wajib memperbarui berkas `.md` terkait pada perubahan yang sama.
