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
- **Quran Content Provider**: `src/quran/content/` menyediakan metadata surah/juz, teks Arab offline, referensi ayat, dan indeks kata stabil dari `public/quran/content.json`. Provider tidak menyimpan reading state dan tidak mengimpor internal Tilawa.
- **Quran Reader UI**: `src/ui/QuranReader.ts` merender tiga ayat di sekitar posisi dari snapshot `ReadingSession`, menyorot ayat aktif, serta menampilkan keadaan idle, target, mismatch, dan tracking tanpa membuat state bacaan baru.
- **Reading Status UX**: `src/ui/readingStatus.ts` memetakan seluruh state `ReadingSession` ke label dan pesan yang terlihat. Pesan mismatch menyebutkan ayat expected dan detected tanpa melakukan recovery atau memindahkan posisi; recovery tetap sepenuhnya dimiliki `ReadingSession`.
- **Active Word Highlight**: `QuranReader` memetakan posisi kata Tilawa yang one-based ke indeks kata provider yang zero-based, lalu menampilkan status `passed`, `current`, dan `upcoming` hanya pada ayat aktif. Progress dari ayat lain tidak dirender.
- **Navigasi Quran UI**: `src/ui/QuranNavigation.ts` menyediakan pencarian seluruh surah, pemilihan ayat langsung, navigasi awal juz, dan pemulihan posisi saat ini; semua target dipasok ke `ReadingSession.start()`.
- **Navigasi Command Langsung**: Hasil parser teks maupun voice langsung memulai atau memindahkan `ReadingSession`; seluruh event recognition juga hanya dikonsumsi oleh `ReadingSession`.
- **Basic Reader Controls**: Parser command yang sama kini mendukung `start`, `current`, `repeat`, `next`, `previous`, `stop`, dan `resume`. Handler aplikasi meneruskan kontrol ke `ReadingSession`; stop mempertahankan posisi agar resume dapat melanjutkan tanpa coordinator baru. Command invalid tidak mengubah snapshot.
- **Checkpoint A.5**: Final architecture review completed: all application reading state is owned by `ReadingSession`, `AnchorCoordinator` has no runtime dependency, command and direct-recitation flows are covered by regression tests, and the production build passes. Checkpoint closure remains subject to parent issue acceptance.
- **Checkpoint B Acceptance Tests**: `test/readerAcceptance.test.ts` exercises direct discovery, manual selection, mismatch recovery, repeat/skip protection, cross-surah progression, final-verse completion, and UI projections from `ReadingSession` snapshots.

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
