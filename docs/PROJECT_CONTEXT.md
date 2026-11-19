# Konteks Hidup Proyek (Project Context)

Dokumen ini mencatat status terkini, batasan mutlak, serta panduan bagi engineer atau agent yang melanjutkan pekerjaan pada proyek `quran-handsfree`.

---

## 1. Status Terkini (Diperbarui 2026-11-18)

**Ringkasan kondisi sekarang**
- **Produk berjalan** di Cloudflare Workers (`https://quran-handsfree.sudirmanhafidz1.workers.dev`), deploy otomatis dari setiap push ke `main`. Teruji di ponsel pemilik: popup pemuatan, mode pesawat, pindah surat (dengan/tanpa basmalah), ayat kembar, jeda 10 detik, isti'adzah, layar menyala, berhenti lalu mulai, bookmark.
- **Dua engine pengenalan** ada di kode: Tilawa 0.4.0 (bawaan kode, cadangan stabil, tag `v0.4.0-stabil`) dan Tilawa 1.0 (dipakai di produksi lewat `VITE_TILAWA_ENGINE=v1`). Tabel perbandingan di `docs/TILAWA_INTEGRATION.md` bagian 0. Rencana: 1.0 menjadi bawaan setelah cadangan model `lite` terbukti di ponsel lain; 0.4.0 dihapus belum direncanakan.
- **Fitur pada 2026-11-17 sampai 2026-11-18**: model dimuat otomatis dengan popup pemblokir, mikrofon menyala otomatis dari navigasi/perintah, cadangan model `lite` otomatis, service worker jaringan-dulu (v4), Wake Lock, Berhenti membuka pencarian baru, jeda hening 10 detik, bookmark manual dan "terakhir dibaca" (localStorage), reset mesin saat membuka posisi sambil mendengarkan (yang terakhir ini belum teruji di ponsel).
- **Prinsip produk**: mikrofon hanya aktif saat aplikasi tampil (disengaja); aturan Qur'an ketat dan dapat diprediksi; perintah suara (Web Speech API) masih butuh internet.
- **Percobaan APK**: jalur WebView (Capacitor) lewat GitHub Actions disiapkan 2026-11-19 (`docs/ANDROID_APK.md`); belum dijalankan dan belum teruji di ponsel.
- **Belum**: APK Android yang teruji (sasaran akhir, tanpa internet), cadangan `lite` di ponsel yang gagal memuat `full`, ketepatan `lite`, "aamiin", AudioWorklet, STT offline.
- **Tes**: `npm test` (tes murni tanpa browser/model); build produksi: `npm run build` (`tsc --noEmit && vite build`).

**Catatan rinci tahap awal (2026-09, masih berlaku sebagai deskripsi arsitektur)**

- **Struktur Folder Modular**: Telah diselaraskan menjadi `src/app/`, `src/app/reading/`, `src/audio/`, `src/recognition/tilawa/`, `src/workers/`, dan `src/ui/`.
- **Batas Integrasi**: `src/recognition/tilawa/` berisi adapter isolasi ke `@tilawa/core`: `TilawaAdapter.ts` (0.4.0) dan `TilawaV1Adapter.ts` (1.0), dipilih oleh `src/recognition/createAdapter.ts`.
- **Kompilasi & Build**: TypeScript checking (`tsc --noEmit`) dan Vite bundle build (`npm run build`) berjalan bersih tanpa error.
- **Service Worker & PWA**: `public/sw.js` (versi cache v4): halaman jaringan-dulu dengan cadangan cache untuk offline, aset berhash cache-dulu tanpa menyimpan HTML; Web Manifest terkonfigurasi (`DECISIONS.md` 2026-11-18).
- **Aset Model**: Aset biner dan dataset besar tidak masuk repo. Jalur 0.4.0: `public/tilawa/` (`npm run setup`). Jalur 1.0: diunduh saat dijalankan (mode `remote`, produksi) atau `public/tilawa-v1/` (`npm run setup:v1`, mode `local`).
- **State Machine Sesi**: `ReadingSession` di `src/app/reading/` adalah satu-satunya pemilik expected verse, detected verse, verse match, dan word progress, serta mengelola discovery, lock, tracking, expected next, mismatch, dan completed dari event `verse_match`/`word_progress`. Saat mismatch terjadi pada expected-next, target tersebut dipertahankan; pengulangan ayat aktif maupun ayat yang dilompati tidak dapat memajukan sesi, dan deteksi expected-next berikutnya memulihkan tracking. Sesi hanya pindah ke ayat berikutnya setelah ayat aktif selesai (kata terakhir ada di `matched_indices`); status selesai bertahan walau snapshot `matched_indices` berubah, dan cursor Tilawa yang masuk ayat berikutnya lebih awal tidak memajukan sesi. Saat ayat terakhir sebuah surat selesai, sesi meminta aplikasi mereset engine agar mencari surat berikutnya (basmalah 1:1 pada saat itu diabaikan dan juga memicu reset).
- **Navigasi Ayat**: `src/quran/navigation.ts` menyediakan `getNextVerse()` untuk perpindahan dalam surat, lintas batas surat, dan penanda selesai setelah ayat 114:6.
- **Quran Content Provider**: `src/quran/content/` menyediakan metadata surah/juz, teks Arab offline, referensi ayat, dan indeks kata stabil dari `public/quran/content.json`. Provider tidak menyimpan reading state dan tidak mengimpor internal Tilawa.
- **Quran Reader UI**: `src/ui/QuranReader.ts` merender tiga ayat di sekitar posisi dari snapshot `ReadingSession`, menyorot ayat aktif, serta menampilkan keadaan idle, target, mismatch, dan tracking tanpa membuat state bacaan baru.
- **Reading Status UX**: `src/ui/readingStatus.ts` memetakan seluruh state `ReadingSession` ke label dan pesan yang terlihat. Pesan mismatch menyebutkan ayat expected dan detected tanpa melakukan recovery atau memindahkan posisi; recovery tetap sepenuhnya dimiliki `ReadingSession`.
- **Active Word Highlight**: `QuranReader` membandingkan cursor kata Tilawa (`word_index`, zero-based) langsung dengan indeks kata provider yang juga zero-based, memakai `matched_indices` untuk kata yang sudah lewat, lalu menampilkan status `passed`, `current`, dan `upcoming` hanya pada ayat aktif. Progress dari ayat lain tidak dirender.
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
2. Untuk menguji engine 0.4.0, siapkan aset di `public/tilawa/` (`npm run setup`, panduan [public/tilawa/README.md](../public/tilawa/README.md)). Untuk engine 1.0 isi `.env.local` dengan `VITE_TILAWA_ENGINE=v1` (lihat `docs/TILAWA_INTEGRATION.md` bagian 6 dan 7).
3. Jalankan `npm run dev` untuk server pengujian lokal di browser.
4. Setiap penambahan fitur atau modifikasi arsitektur wajib memperbarui berkas `.md` terkait pada perubahan yang sama.
