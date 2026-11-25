# Konteks Hidup Proyek (Project Context)

Dokumen ini mencatat status terkini, batasan mutlak, serta panduan bagi engineer atau agent yang melanjutkan pekerjaan pada proyek `quran-handsfree`.

---

## 1. Status Terkini (Diperbarui 2026-11-24)

**Ringkasan kondisi sekarang**
- **Produk berjalan** di Cloudflare Workers (`https://quran-handsfree.sudirmanhafidz1.workers.dev`), deploy otomatis dari setiap push ke `main`. Teruji di ponsel pemilik: halaman pemuatan model, mode pesawat, pindah surat (dengan/tanpa basmalah), ayat kembar, jeda 10 detik, isti'adzah, layar menyala, berhenti lalu mulai, bookmark.
- **Dua engine pengenalan** ada di kode: Tilawa 1.0 (bawaan kode sejak 2026-11-23; produksi dan APK) dan Tilawa 0.4.0 (cadangan stabil, dipilih dengan `VITE_TILAWA_ENGINE=v0`, tag `v0.4.0-stabil`). Tabel perbandingan di `docs/TILAWA_INTEGRATION.md` bagian 0. 0.4.0 dihapus belum direncanakan.
- **Fitur pada 2026-11-17 sampai 2026-11-18**: model dimuat otomatis dengan layar persiapan penuh (dulu popup), mikrofon menyala otomatis dari navigasi/perintah, cadangan model `lite` otomatis, service worker jaringan-dulu (v4), Wake Lock, Berhenti membuka pencarian baru, jeda hening 10 detik, bookmark manual dan "terakhir dibaca" (localStorage), reset mesin saat membuka posisi sambil mendengarkan (yang terakhir ini belum teruji di ponsel).
- **Prinsip produk**: mikrofon hanya aktif saat aplikasi tampil (disengaja); aturan Qur'an ketat dan dapat diprediksi; perintah suara (Web Speech API) masih butuh internet.
- **APK Android (WebView/Capacitor)**: dibangun lewat GitHub Actions (`docs/ANDROID_APK.md`). Model `full` dan `lite` jalan di ponsel pemilik; `lite` juga sudah jalan di ponsel teman (kadang agak lama, tetapi berjalan). Tombol kembali Android teruji 2026-11-23: dari layar baca dan tab Cari/Info ke Beranda, dari Beranda menutup aplikasi, mikrofon mati setelah keluar.
- **Tata letak seperti aplikasi (2026-11-23)**: tab Beranda/Cari/Info, layar baca penuh tanpa tab bar (Kembali menghentikan pendengaran), ikon bookmark di tiap ayat, kartu "Terakhir dibaca" dan daftar bookmark di Beranda, halaman persiapan model layar penuh, tombol kembali Android. Rancangan dan alasan: `DECISIONS.md` 2026-11-19; arsitektur: `ARCHITECTURE.md`. Layar baca masih menampilkan 3 ayat (keputusan jumlah ayat ditunda). Setelah satu ayat dibaca penuh, layar berfokus ke ayat berikutnya dan "terakhir dibaca" menyimpan ayat berikutnya itu (2026-11-23).
- **Font Qur'an dan ukuran huruf (2026-11-24, branch `ui-font-quran`, menunggu uji di ponsel)**: font Scheherazade New Regular (SIL OFL; sebelumnya Amiri, diganti 2026-11-25 karena tanda menumpuk) kini ikut di dalam aplikasi (`public/fonts/`), sebelumnya tidak pernah dimuat sehingga harakat memakai font bawaan perangkat. Di branch yang sama ada juga pengaturan ukuran huruf Arab: tombol A−/A+, 5 tingkat, diingat di perangkat (modul `src/app/displaySettings.ts`). Font dan ukuran huruf sudah di `main`. Di branch `ui-pengaturan` (belum digabung, belum di-push, menunggu uji APK): variabel warna CSS, tab Pengaturan (ayat contoh, ukuran huruf dipindah dari layar baca, pilihan warna Terang/Gelap/Ikut sistem) dan mode gelap (`src/app/theme.ts`). `DECISIONS.md` 2026-11-24 dan 2026-11-25.
- **Belum**: daftar uji offline APK lengkap (`docs/ANDROID_APK.md` bagian 4: perintah suara di APK diperkirakan tidak berfungsi), ketepatan `lite`, keputusan jumlah ayat di layar baca, naik ke Tilawa `rc.1`, menjadikan engine 1.0 bawaan kode, "aamiin", AudioWorklet, STT offline.
- **Tes**: `npm test` (tes murni tanpa browser/model); build produksi: `npm run build` (`tsc --noEmit && vite build`).

**Catatan rinci tahap awal (2026-09, masih berlaku sebagai deskripsi arsitektur)**

- **Struktur Folder Modular**: Telah diselaraskan menjadi `src/app/`, `src/app/reading/`, `src/audio/`, `src/recognition/tilawa/`, `src/workers/`, dan `src/ui/`.
- **Batas Integrasi**: `src/recognition/tilawa/` berisi adapter isolasi ke `@tilawa/core`: `TilawaAdapter.ts` (0.4.0) dan `TilawaV1Adapter.ts` (1.0), dipilih oleh `src/recognition/createAdapter.ts`.
- **Kompilasi & Build**: TypeScript checking (`tsc --noEmit`) dan Vite bundle build (`npm run build`) berjalan bersih tanpa error.
- **Service Worker & PWA**: `public/sw.js` (versi cache v6; `APP_SHELL` juga memuat font Qur'an `/fonts/ScheherazadeNew-Regular.ttf`): halaman jaringan-dulu dengan cadangan cache untuk offline, aset berhash cache-dulu tanpa menyimpan HTML; Web Manifest terkonfigurasi (`DECISIONS.md` 2026-11-18).
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
2. Engine 1.0 adalah bawaan (lihat `docs/TILAWA_INTEGRATION.md` bagian 6 dan 7). Untuk menguji engine 0.4.0, isi `.env.local` dengan `VITE_TILAWA_ENGINE=v0` dan siapkan aset di `public/tilawa/` (`npm run setup`, panduan [public/tilawa/README.md](../public/tilawa/README.md)).
3. Jalankan `npm run dev` untuk server pengujian lokal di browser.
4. Setiap penambahan fitur atau modifikasi arsitektur wajib memperbarui berkas `.md` terkait pada perubahan yang sama.

## 4. Aturan Kerja dengan Pemilik Proyek

- Bahasa Indonesia sederhana; tanpa ide liar. Rencanakan dulu, **tunggu persetujuan** sebelum mengubah kode.
- Perubahan besar di branch; tiap perubahan menyertakan tes murni dan pembaruan `.md` yang terkait.
- **Tanya sebelum push ke `main`.** Push ke branch dan pembangunan APK `full` untuk uji ponsel boleh. `main` otomatis di-deploy ke Cloudflare.
- Inti Tilawa tidak diubah. Pengujian ponsel: APK dari Actions (`android-apk.yml`, pilih branch dan tier), lalu pemilik menyalin "Catatan bacaan" dari tab Info untuk diagnosis.
- Sandbox tidak bisa `npm install` atau `npm run build`; build diverifikasi oleh Actions/Cloudflare. Pesan hook "unpushed commits" sering basi: cek `git ls-remote --heads origin <branch>` terhadap `git rev-parse HEAD`.
- Kegagalan build `403` dari Maven Central di Actions bersifat sementara: jalankan ulang (`gh run rerun`).

