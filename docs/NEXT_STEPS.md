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
- Tambahkan caching model/aset menggunakan IndexedDB dan/atau Cache Storage.
- Sediakan manifest versi, verifikasi SHA-256, progres unduhan, dan indikator
  ketersediaan offline.

## 5. Evaluasi Recognition Engine

Evaluasi versi upstream Tilawa terbaru saat tahap ini dimulai; jangan
mengunci roadmap pada Zipformer v0.3.0. Engine baru, bila diperlukan, harus
berada di belakang kontrak `RecognitionAdapter`, sehingga UI dan
`ReadingSession` tidak berubah.

Sebelum mengganti default, lakukan A/B test untuk deteksi ayat, pelacakan kata,
jeda, waqaf, pengulangan, koreksi, recovery mismatch, bacaan multi-ayat,
latensi, penggunaan memori, dan stabilitas perangkat.

## 6. Android dan Fitur Lanjutan

Setelah Quran Reader, auto-scroll, dan recognition flow stabil, porting ke
React Native/native Android dengan offline recognition dan penyimpanan model
lokal. Tambahkan bookmark, last read, terjemahan, pencarian, tema, pengaturan
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
