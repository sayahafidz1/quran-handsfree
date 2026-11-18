# Langkah Pengembangan Berikutnya (Next Steps)

Dokumen ini memuat urutan pengembangan `quran-handsfree`. Prioritas saat ini
adalah menstabilkan pengalaman membaca Al-Qur'an; recognition engine Tilawa
tetap diisolasi melalui `TilawaAdapter`.

## 1. Quran Reader UI

- Tampilkan surat dan ayat dengan pemilihan surat/ayat.
- Navigasi UI kini menyediakan pencarian 114 surat, pilihan ayat langsung, awal setiap juz, dan pemulihan posisi bacaan melalui `ReadingSession.start({ surah, ayah })`.
- Sediakan pengaturan ukuran font dan layout yang nyaman untuk membaca lama.
- Sorot ayat aktif dan kata aktif berdasarkan `word_progress`.
- Tampilkan status listening saat Hands-Free Mode aktif.
- Tampilkan mismatch/recovery tanpa mengganggu pembacaan.

UI tidak boleh bergantung langsung pada Zipformer atau model recognition
tertentu. Kontrak adapter yang harus tetap stabil adalah `verse_match`,
`word_progress`, `loading_status`, `ready`, dan `error`.

Auto-follow Quran Reader kini hanya aktif saat ayat berubah, menggunakan
`scrollIntoView({ behavior: "smooth", block: "center" })`. Interaksi manual
(wheel, touch, atau tombol navigasi keyboard) menangguhkan follow sementara;
resume hanya memusatkan ayat aktif dan tidak memengaruhi state bacaan.

## 2. Follow-Along dan Auto-Scroll

Integrasikan `ReadingSession` dengan Quran Reader menggunakan alur:

```text
Microphone -> RecognitionAdapter -> verse_match / word_progress
           -> ReadingSession -> Quran Reader UI
```

`verse_match` menentukan ayat aktif dan `word_progress` menentukan kata aktif.
Auto-scroll harus halus, melakukan scroll utama saat ayat berubah, tidak meloncat
pada setiap perubahan kata, serta tetap stabil saat pengulangan bacaan atau
perpindahan ke ayat berikutnya.

## 3. Validasi Hands-Free Reading

Uji baseline Zipformer dengan skenario membaca satu atau beberapa ayat,
jeda, waqaf, pengulangan kata/ayat, koreksi bacaan, tempo lambat/cepat,
perpindahan ayat, dan mismatch terhadap ayat yang dipilih manual. Fokus tahap
ini adalah kestabilan follow-along, bukan evaluasi tajwid.

Skenario yang wajib dicatat hasilnya (log `VITE_DEBUG_RECOGNITION=true`) pada tes nyata:

- Membaca lurus Al-Ikhlas 112:1-2: sorotan harus mencapai "Ahad" lalu pindah ke ayat 2 tanpa `mismatch`.
- Ayat panjang (misalnya Al-Bayyinah 98:2): membaca beberapa kata lalu langsung ayat berikutnya harus `mismatch` dan sorotan tetap di ayat aktif; menyelesaikan ayat aktif membuka ayat berikutnya.
- Melewati satu ayat penuh: harus `mismatch`, lalu pulih saat ayat yang diharapkan dibaca.
- Membaca ulang kata sebelumnya di ayat yang sama setelah sorotan macet: sorotan harus kembali mengikuti.
- Kata terakhir ayat yang dibaca benar tetapi tidak masuk `matched_indices`: catat seberapa sering sesi tertahan; hasilnya menentukan perlu tidaknya toleransi atau kontrol manual.
- Kata kembar di ayat berurutan ("Allahu" di 112:1 dan 112:2): catat bila sorotan pindah terlalu cepat.
- Selesai satu surat lalu langsung membaca surat berikutnya (Al-Ikhlas ke Al-Falaq), sekali tanpa bismillah dan sekali dengan bismillah: sesi harus berpindah ke 113:1 tanpa `mismatch`. Catat log bila macet; belum diketahui apakah engine mengirim basmalah sebagai `verse_match` 1:1 dan berapa kali `reset()` terpicu.
- Surat berawalan huruf ambigu ("Alif Lam Mim", surat 2, 3, 29-32): catat apakah engine mengunci terlalu dini ke surat yang salah.

Acceptance suite `test/readerAcceptance.test.ts` kini memverifikasi alur
produk tanpa model/browser: discovery, seleksi manual, mismatch dan recovery,
repeat/skip, batas surat, ayat terakhir, serta proyeksi status dan kata aktif
dari snapshot `ReadingSession`.

## 4. Web/PWA Technical Hardening

Setelah UX utama stabil:

- Ganti `ScriptProcessorNode` di `src/audio/MicrophoneCapture.ts` dengan
  `AudioWorkletNode` tanpa mengubah kontrak `onSamples(Float32Array)`.
  Ditunda dengan sengaja (2026-11-18): mengubah jalur suara untuk semua perangkat tanpa bisa menguji mikrofon di lingkungan pengembangan; kecepatan di ponsel pemilik sudah aman. Kerjakan bila ada masalah nyata, dengan cadangan ke cara lama.
- Wake Lock layar sudah ada dan teruji di ponsel pemilik (2026-11-18, `src/app/wakeLock.ts`): layar tetap menyala selama mendengarkan. Mikrofon berhenti saat aplikasi ditinggalkan atau layar dikunci sendiri; itu disengaja (`DECISIONS.md` 2026-11-18), bukan masalah.
- Caching sudah ada: model 1.0 disimpan SDK di Cache API (dan penanda `lite` di `tilawa-v1-prefs`), aset aplikasi oleh service worker. Indikator "tersedia offline" yang eksplisit belum ada.
- Service worker sudah diperbaiki pada 2026-11-18 (`DECISIONS.md`): halaman jaringan-dulu, aset cache-dulu tanpa menyimpan HTML. Teruji di ponsel pemilik: offline/mode pesawat berjalan. Masih perlu dipastikan di perangkat lain bahwa pengguna lama pulih setelah 1 sampai 2 kali refresh biasa. Cache aset berhash lama menumpuk di `quran-handsfree-v4` sampai versi cache dinaikkan.
- SDK 1.0 sudah memeriksa SHA-256 model saat memuat dan popup pemuatan sudah ada; progres unduhan berupa persen dan indikator ketersediaan offline belum.

## 5. Evaluasi Recognition Engine

Status 2026-11-18: Tilawa 1.0 sudah dipakai di produksi Cloudflare; 0.4.0 tetap bawaan kode dan cadangan (`TILAWA_INTEGRATION.md` bagian 0). Langkah berikut: jadikan 1.0 bawaan kode setelah cadangan `lite` terbukti di ponsel lain; menghapus 0.4.0 baru dipertimbangkan sesudahnya.

Evaluasi versi upstream Tilawa terbaru saat tahap ini dimulai; jangan
mengunci roadmap pada Zipformer v0.3.0. Engine baru, bila diperlukan, harus
berada di belakang kontrak `RecognitionAdapter`, sehingga UI dan
`ReadingSession` tidak berubah.

Evaluasi Tilawa 1.0 berjalan di `main` (`VITE_TILAWA_ENGINE=v1`; 0.4.0 tetap default). Mode tanpa internet: `VITE_TILAWA_V1_ASSETS=local` setelah `npm run setup:v1` (lihat `TILAWA_INTEGRATION.md` bagian 7); uji dengan internet diputus dan jendela incognito, pastikan tab Network tidak memuat dari domain lain. Pilihan model full vs lite untuk APK menunggu pengukuran di ponsel. Deploy Cloudflare (mode `remote`) sukses pada 2026-11-17 di `https://quran-handsfree.sudirmanhafidz1.workers.dev`; **tes di ponsel (unduh model, mikrofon, bacaan) belum dilakukan**. Build command Cloudflare memakai `rm -f` untuk WASM WebGPU yang terlalu besar (lihat `DECISIONS.md` 2026-11-17 dan `TILAWA_INTEGRATION.md` bagian 6). Skenario uji, bandingkan dengan 0.4.0 dan catat log (`VITE_DEBUG_RECOGNITION=true`, tag log `[TILAWA_V1]`):

- Waktu sampai terkunci di awal bacaan dan jumlah lompatan ayat/surat yang salah.
- Aturan baru (lihat `DECISIONS.md` 2026-11-15): setelah surat selesai/jeda hening 10 detik/basmalah, ayat mana pun boleh terkunci (angka 10 detik dari keputusan 2026-11-17, belum diuji nyata); uji Al-Fatihah lalu An-Naba 78:31 tanpa bismillah, jeda hening >10 detik sesudah surat belum selesai, dan apakah derau mengunci ayat yang salah.
- Ayat kembar: mulai Al-Baqarah 2:214 dan berhenti di "walamma"; kunci sementara harus pindah dari 3:142 ke 2:214. Kata terlewat di tengah ayat (mis. "min qablihim" di 29:3): sorotan mengikuti; pewarnaan kata terlewat ditunda. Belum terbukti: berhenti sebelum kata terakhir tanpa membaca ayat berikutnya lalu ayat maju sendiri (butuh log run 29:4).
- Isti'adzah di awal dan di tengah sesi (apakah tetap mengunci ke 16:98?).
- Berhenti lalu Mulai mendengarkan lagi membuka pencarian baru (2026-11-18, `DECISIONS.md`): sudah teruji aman di ponsel pemilik.
- Teruji aman di ponsel pemilik (2026-11-18): popup pemuatan, mode pesawat, Al-Ikhlas ke Al-Falaq dengan dan tanpa basmalah, ayat kembar 2:214 (tetap di ayat itu sampai ayat berikutnya dibaca, sesuai maksud), jeda 10 detik, isti'adzah langsung ke mode pencarian, membaca sambil berjalan, layar tetap menyala.
- Belum teruji di ponsel (2026-11-18): reset mesin saat bookmark/Buka ayat ditekan sambil mendengarkan; baca di tengah ayat, tekan bookmark lain, langsung baca ayat itu, pastikan terkunci tanpa `mismatch` di awal.
- Belum ada bukti: cadangan `lite` di ponsel yang tadinya gagal, pemulihan perangkat yang rusak, log run 29:4, ketepatan `lite`.
- "Aamiin" belum punya pemicu (Tilawa 1.0 tidak mengirimnya sebagai event); sengaja belum dikerjakan.
- Jeda panjang (>8 detik) lalu lanjut membaca; dan setelah `mismatch`.
- Shalat sunnah: takbir, ruku', sujud, bangkit, Al-Fatihah rakaat berikutnya, surat belum selesai lalu surat baru.
- Al-Ikhlas ke Al-Falaq dengan dan tanpa bismillah; surat berawalan huruf ambigu.
- Sorotan kata selaras dengan teks di layar (segmentasi `ref-v2` vs `content.json`), dan ayat terakhir terdeteksi selesai.
- Berisik dapur/suara bayi; mikrofon (1.0 menonaktifkan echo cancellation/noise suppression, aplikasi saat ini mengaktifkannya).
- Waktu muat model (full vs lite) dan kelancaran di ponsel; kebutuhan internet/CDN. Sudah ada cadangan otomatis ke `lite` bila `full` gagal dimuat (2026-11-17, `DECISIONS.md`); perlu dites di ponsel yang tadinya gagal, dan ketepatan `lite` perlu diukur. Model kini dimuat otomatis saat halaman dibuka dan mikrofon menyala otomatis dari Buka ayat/juz, Kembali ke posisi, serta perintah `open`/`start`/`resume` (2026-11-17); perlu dites di ponsel (terutama izin mikrofon otomatis di iOS Safari, dan perilaku Buka ayat saat sedang mendengarkan).

Sebelum mengganti default, lakukan A/B test untuk deteksi ayat, pelacakan kata,
jeda, waqaf, pengulangan, koreksi, recovery mismatch, bacaan multi-ayat,
latensi, penggunaan memori, dan stabilitas perangkat.

## 6. Android dan Fitur Lanjutan

Setelah Quran Reader, auto-scroll, dan recognition flow stabil, porting ke
React Native/native Android dengan offline recognition dan penyimpanan model
lokal. Bookmark dan last read sudah ada (2026-11-18, `DECISIONS.md`; menunggu uji di ponsel). Tambahkan terjemahan, pencarian, tema, pengaturan
font, dan preferensi membaca.

Evaluasi makhraj/tajwid bukan bagian MVP. Fitur verifier atau bantuan
pelafalan baru dipertimbangkan setelah recognition dan word-level tracking
tervalidasi.

## Urutan Prioritas

```text
Quran Reader UI
  -> Active Ayah / Active Word
  -> Smooth Auto-Scroll
  -> Hands-Free UX Testing
  -> Web/PWA Hardening
  -> Evaluate Latest Tilawa Engine
  -> A/B Test Recognition
  -> Android / React Native
  -> General Quran Features
  -> Tajwid / Pronunciation Assistance
```
