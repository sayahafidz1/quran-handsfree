# Percobaan APK Android (Jalur WebView + Capacitor)

Status: **teruji di ponsel pemilik** (2026-11-25). Percobaan dimulai 2026-11-19; daftar uji bagian 4 dinyatakan lolos semua oleh pemilik, kecuali perintah suara yang sengaja ditutup di APK (poin 6). Pemilik tidak mencatat rincian (jenis ponsel, versi Android dan WebView, lama muat model, ukuran APK), jadi angka-angka itu belum ada di dokumen ini. Keputusan dan alasannya ada di `DECISIONS.md` (2026-11-19).

## 1. Apa ini
Aplikasi web yang sama dibungkus Capacitor menjadi APK Android. Seluruh berkas web **dan model Tilawa 1.0 ikut di dalam APK** (mode `local`), jadi tidak ada unduhan model dan tidak ada risiko cache terhapus. Kode aplikasi tidak diubah; hanya ditambahkan:
- `capacitor.config.json` (nama aplikasi, ID paket `com.sayahafidz.quranhandsfree`, folder web `dist`, skema `https`).
- `.github/workflows/android-apk.yml` (alur kerja GitHub Actions, dijalankan manual).
- Folder `android/` **tidak masuk Git** (`.gitignore`); dibuat ulang oleh alur kerja tiap build.
- Capacitor (`@capacitor/*@6`) dipasang hanya di dalam alur kerja dengan `--no-save`, jadi `package.json` dan `package-lock.json` tidak berubah dan build Cloudflare tidak terpengaruh.

## 2. Cara membangun APK
1. Di GitHub buka repo, tab **Actions**, pilih **Build Android APK**, tekan **Run workflow**.
2. Pilih model: `lite` (25 MB, untuk ponsel dengan RAM kecil), `full` (68 MB), atau `both` (dua APK).
3. Tunggu sampai hijau (beberapa menit). Buka hasil run, bagian **Artifacts**, unduh `quran-handsfree-apk-lite` dan/atau `quran-handsfree-apk-full` (berkas zip berisi APK; hasil disimpan 7 hari).
4. Ekstrak zip, kirim APK ke ponsel, lalu pasang (izinkan "Pasang aplikasi dari sumber tidak dikenal" untuk aplikasi yang membukanya).
5. Ini APK **debug**: tidak untuk Play Store, tetapi cukup untuk uji. Memasang ulang APK yang lebih baru menimpa yang lama selama ID paketnya sama.

Bila build gagal, buka langkah yang merah di halaman run, salin log-nya, dan kirimkan untuk diperbaiki.

## 3. Pilihan model
- **HP Anda**: `full` (sama seperti yang berjalan di Cloudflare).
- **HP dengan RAM kecil** (misalnya HP yang gagal dengan "failed to allocate a buffer of size 67759744"): `lite`. Kegagalan itu soal RAM saat model dimuat, bukan soal cache, jadi membundel `full` di APK tidak menolong.
- Di APK (mode `local`) **tidak ada cadangan otomatis** ke `lite` (cadangan hanya untuk mode `remote`; `DECISIONS.md` 2026-11-17). Tier ditentukan saat build.
- Ketepatan `lite` belum terukur.

## 4. Daftar uji di ponsel
Hasil 2026-11-25: semua poin lolos menurut pemilik (poin 6 sengaja berbeda di APK). Daftar ini tetap dipakai sebagai uji ulang untuk APK berikutnya.
Catat jenis ponsel, versi Android, dan versi Android System WebView (Pengaturan, Aplikasi).
1. Pasang, lalu buka dalam **mode pesawat sejak awal**: halaman persiapan model selesai tanpa internet dan model siap. Catat lama muatnya.
2. Izin mikrofon muncul dan bacaan terdeteksi (coba Al-Ikhlas).
3. Layar tetap menyala saat mendengarkan (Wake Lock di WebView belum terbukti).
4. Bookmark dan "terakhir dibaca" tetap ada setelah aplikasi ditutup dan dibuka lagi.
5. Kartu Navigasi Quran (pemilih surat/ayat/juz) berfungsi. Kotak ketik perintah ada di kartu perintah suara, yang di APK disembunyikan (poin 6); di Web tetap berfungsi.
6. Tab Cari: kartu **Navigasi Perintah Suara** tidak tampil, diganti kartu "sedang dalam perbaikan" (sejak 2026-11-25; Web Speech API tidak berfungsi di WebView). Di versi Web kartu suara tetap tampil. Pemilih surat/ayat/juz tetap berfungsi di APK.
7. Bila gagal memuat model: salin pesan error yang tampil.
8. Tata letak baru (branch `ui-app-layout`): tab Beranda/Cari/Info; **Mulai membaca** menyalakan mikrofon; **Kembali** di layar baca menghentikan pendengaran; ikon bookmark di tiap ayat menyimpan tanpa menghentikan bacaan.
9. **Tombol kembali Android** di layar baca: harus kembali ke tab asal dan menghentikan mikrofon, bukan menutup aplikasi. Dari tab Cari/Info tombol kembali ke Beranda; dari Beranda menutup aplikasi. Setelah keluar dari layar baca pastikan indikator mikrofon Android mati. Di tab Info baris "Tombol kembali" menunjukkan apakah plugin terpasang (diagnosis). Catat bila ada yang berbeda.
10. **Catatan bacaan**: bila status "Menunggu ayat berikutnya" muncul padahal kata terakhir belum dibaca, segera buka tab Info, buka "Catatan bacaan (untuk diagnosis)", tekan **Salin catatan**, lalu tempelkan ke pengembang bersama keterangan ayat dan kata mana yang belum Anda baca.

## 5. Hal yang belum pasti
- Alur kerja sudah dijalankan dan menghasilkan APK yang terpasang dan teruji di ponsel pemilik (2026-11-25), termasuk izin mikrofon di WebView (bacaan terdeteksi). Versi Java 17 dan Capacitor 6 terbukti bisa dipakai.
- Ukuran APK diperkirakan sekitar 90 sampai 110 MB untuk `full` (belum terukur); batas simpanan artifact paket Free 500 MB.
- Perintah suara offline di APK membutuhkan langkah terpisah (plugin pengenal suara Android), dengan persetujuan tersendiri. Prioritas rendah (pemilik, 2026-11-25): untuk sementara kartunya disembunyikan di APK. Analisis opsi ada di `DECISIONS.md` 2026-11-25 (Perintah Suara di APK).
- Service worker tetap terdaftar di dalam APK; efeknya belum diamati. Tidak mengganggu asetnya, karena semua berasal dari dalam aplikasi.
- Push berkas `.github/workflows/` dari sesi pengembangan bisa ditolak GitHub (izin token). Bila terjadi, berkas ditambahkan lewat web GitHub (Add file).
