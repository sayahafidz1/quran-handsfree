# Arsitektur Aplikasi (Architecture)

## 1. Diagram Arsitektur Jalur Ganda (Dual-Path Architecture)

Aplikasi `quran-handsfree` memiliki dua jalur independen untuk menentukan posisi bacaan Al-Qur'an sebelum masuk ke mode penguncian (*Locked Position*) dan verifikasi:

```text
                     [ Pengguna / Mikrofon ]
                               │
         ┌─────────────────────┴─────────────────────┐
         │                                           │
         ▼ (Aliran Audio Bacaan)                     ▼ (Perintah Suara Navigasi)
┌───────────────────────────────┐           ┌───────────────────────────────┐
│ src/audio/ (MicrophoneCapture)│           │ src/command/ (Voice Recognizer│
│ - 16 kHz Mono Float32Array    │           │ - WebSpeech / Offline STT     │
└───────────────┬───────────────┘           └───────────────┬───────────────┘
                │                                           │ Transkrip Perintah
                ▼ (RecognitionAdapter)                      ▼
┌───────────────────────────────┐           ┌───────────────────────────────┐
│ src/recognition/tilawa/       │           │ src/command/commandParser.ts  │
│ - TilawaAdapter / V1Adapter   │           │ - Ekstraksi Surat & Nomor Ayat│
│ - Isolasi @tilawa/core        │           │ - Parser Angka Kata Bahasa ID │
└───────────────┬───────────────┘           └───────────────┬───────────────┘
                │ Worker RPC                                │
                ▼                                           ▼
┌───────────────────────────────┐           ┌───────────────────────────────┐
│ src/workers/recognition.worker│           │ src/quran/validator.ts        │
│ - onnxruntime-web (WASM)      │           │ - Metadata 114 Surat & Ayah   │
│ - Tilawa 0.4.0 atau 1.0       │           │ - Validasi Batas & Alias Surat│
└───────────────┬───────────────┘           └───────────────┬───────────────┘
                │                                           │
                │ verse_match (Discovery)                   │ { surah, ayah } (Valid)
                ┌─────────────────────┴─────────────────────┐
                │                                           │
                ▼                                           ▼
        ┌────────────────────────────────────────┐
        │ src/app/reading/ReadingSession.ts      │
        │ command target + all recognition events │
        └────────────────────┬───────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ Mode Verifier (Backlog)   │
                        │ - Follow-along per kata   │
                        │ - Evaluasi ketepatan      │
                        └───────────────────────────┘
```

---

## 2. Struktur Folder & Tanggung Jawab Layer

- **`src/app/`**:
  - Menginisialisasi aplikasi, mengaitkan adapter pengenalan tilawah dan perintah suara dengan layer UI serta audio capture.
  - Menampung state/control layer `ReadingSession`, satu-satunya pemilik state machine `idle -> discovering -> locked -> tracking -> expecting_next -> tracking`, state `mismatch`/`completed`, expected/detected verse, verse match, dan word progress. Mismatch tidak pernah memajukan ayat aktif; setelah mismatch, ayat yang diharapkan tetap menjadi satu-satunya ayat yang dapat memajukan sesi sehingga pengulangan atau lompatan ayat dapat dipulihkan dengan aman. Event `verse_match` dapat memulai discovery dan mengunci ayat secara langsung ketika belum ada target manual; command manual tetap memasok target yang harus cocok.
  - Hasil `parseNavigationCommand()` dari input teks maupun voice recognizer langsung dipetakan ke `ReadingSession.start({ surah, ayah })`.
  - `ReadingSession` juga menjadi pemilik transisi kontrol hands-free (ulang, next,
    previous, stop, dan resume), tanpa coordinator baru.
  - Ayat dianggap selesai (`hasReachedVerseEnd`) saat kata terakhirnya ada di `matched_indices`; hanya setelah itu `expectedNextVerse` terisi dan ayat berikutnya dapat diikuti. Status selesai menempel meski snapshot `matched_indices` berubah, sedangkan sorotan kata mengikuti snapshot terbaru. Cursor Tilawa yang lebih dulu masuk ayat berikutnya tidak memajukan sesi (`verse_match` menjadi `mismatch`, `word_progress` diabaikan).
  - `ReadingSession` tidak pernah memanggil engine. Ia hanya *meminta* restart discovery lewat `onDiscoveryRestart()`: sekali saat ayat terakhir sebuah surat selesai (ayat berikutnya adalah ayat 1 surat lain), dan saat basmalah (`verse_match` 1:1) terdeteksi sementara sesi menunggu ayat 1 surat berikutnya (basmalah itu bukan `mismatch`). `src/app/app.ts` menjalankan permintaan itu dengan `recognition.reset()` hanya saat sedang mendengarkan.
  - Penanda `discoveryOpen` (lihat `DECISIONS.md` 2026-11-15): setelah surat selesai, setelah `handlePause()` (10 detik tanpa event pengenalan sama sekali, dipicu `InactivityTimer` di `app.ts`), atau saat `verse_match` ber-`basmala` ayat 1, deteksi berikutnya mengunci di mana pun tanpa `mismatch`. Di dalam satu surat aturan tetap ketat.
  - Kunci hasil discovery bersifat sementara (`provisional`) sampai ayatnya selesai: koreksi engine ke ayat di surat lain (ayat kembar seperti 3:142 vs 2:214) mengunci ulang tanpa `mismatch`; lompatan dalam surat yang sama tetap `mismatch`. Setelah ayat selesai, aturan ketat berlaku. Target manual tidak pernah sementara.
  - `handleRecognitionEvent()` meneruskan `verse_match` dan `word_progress` hanya ke `ReadingSession.handleEvent()`. UI membaca snapshot sesi.
  - Persiapan dan mikrofon otomatis (lihat `DECISIONS.md` 2026-11-17): `app.ts` memuat model begitu halaman dibuka (`beginPreparing()`, dengan bar loading), dan `requestListening()` menyalakan mikrofon dari Buka ayat, Buka juz, Kembali ke posisi, perintah `open`, dan `start`/`resume`. Bila model belum siap, permintaan menunggu sampai siap. Keadaan tunggu/siap/mendengarkan ada di `src/app/listenGate.ts` (murni, diuji di `test/listenGate.test.ts`). Tombol "Siapkan pengenalan" hanya dipakai sebagai "Coba lagi" setelah gagal.
  - Layar dijaga tetap menyala selama mendengarkan oleh `src/app/wakeLock.ts` (Screen Wake Lock, bagian browser disuntikkan sehingga bisa dites): diminta saat `startListening()`, dilepas saat `stopListening()`, dan diminta ulang bila halaman tampil kembali. Tidak ada UI; browser tanpa API itu tetap berjalan seperti biasa.
  - `ReadingSession.stopListening()` (Berhenti manual) membuka `discoveryOpen`: mulai mendengarkan lagi mengunci di mana pun pembaca berada, termasuk bila ada target manual. Buka ayat lalu mikrofon otomatis (tanpa Berhenti) tetap ketat.
  - Popup pemuatan (`<dialog id="loading-dialog">` di `index.html`, logikanya di `app.ts`): dibuka dengan `showModal()` saat model mulai dimuat, menahan seluruh halaman (klik, fokus, Esc), menampilkan status dan bar loading, lalu menutup sendiri saat model siap atau error. Setelah 60 detik tanpa hasil muncul tombol "Tutup" sebagai pengaman unduhan macet. Urutan kartu di halaman: Pengenalan Bacaan, Bacaan Tilawa terdeteksi, Quran Reader, Navigasi Quran, Navigasi Perintah Suara, Posisi Terkunci, Tentang & Lisensi; urutan tidak dipakai kode (semua lewat `id`).
  - Bookmark dan "terakhir dibaca" (lihat `DECISIONS.md` 2026-11-18): `src/app/bookmarks.ts` adalah modul murni (penyimpanan disuntikkan, dites di `test/bookmarks.test.ts`), `src/ui/BookmarksPanel.ts` kartu UI-nya, dan `app.ts` menyambungkannya: `currentVerse` dari snapshot `ReadingSession` memperbarui "terakhir dibaca", sedangkan membuka bookmark memakai `openPosition(reference)` di `app.ts` (`readingSession.start(reference)`, `recognition.reset()` bila sedang mendengarkan, lalu `requestListening()`), sama seperti Buka ayat, Buka juz, dan perintah `open` (`DECISIONS.md` 2026-11-18). Penyimpanan di localStorage perangkat, tanpa internet; kartu berada tepat setelah Navigasi Quran.
- **`src/audio/`**:
  - Bertanggung jawab penuh atas penangkapan audio perangkat keras dan resample ke format standar 16 kHz Float32.
- **`src/command/`**:
  - **`types.ts`**: Kontrak antarmuka `VoiceCommandRecognizer`, `NavigationCommand`, dan `ParseCommandResult`.
  - **`numberParser.ts`**: Parser angka kata bahasa Indonesia (e.g. *"dua ratus lima puluh lima"* -> `255`, *"lima puluh delapan"* -> `58`, *"sepuluh"* -> `10`) dan angka digit.
  - **`commandParser.ts`**: Engine pemetaan pola perintah navigasi bebas (e.g. *"Al-Baqarah ayat 255"*, *"Surat Yasin ayat 58"*, *"Al-Kahfi ayat 10"*, *"Surat 2 ayat 255"*).
    Parser juga menghasilkan command deterministik `start`, `current`, `repeat`, `next`,
    `previous`, `stop`, dan `resume`. Semua hasil command melewati handler aplikasi
    yang sama; command invalid tidak memanggil `ReadingSession`.
  - **`recognizers/`**: Implementasi recognizer yang dapat diganti (*pluggable*), seperti `WebSpeechCommandRecognizer` dan `TextCommandRecognizer`.
- **`src/quran/`**:
  - **`surahData.ts`**: Data 114 surat Al-Qur'an lengkap dengan nama latin, nama arab, batas jumlah ayat yang akurat, serta kamus alias/variasi pelafalan.
  - **`validator.ts`**: Logika pencarian alias dan validasi batas ayat Al-Qur'an murni *offline* tanpa ketergantungan luar.
  - **`navigation.ts`**: Menghitung referensi ayat berikutnya, termasuk perpindahan ke awal surat berikutnya dan akhir Al-Qur'an.
  - **`content/`**: Quran Content Provider yang membaca asset teks offline independen, menyediakan surah/juz, referensi ayat, teks Arab, dan indeks kata stabil. Provider ini tidak memiliki reading state dan tidak bergantung pada Tilawa.
- **`src/recognition/` & `src/recognition/tilawa/` (Integration Boundary)**:
  - Adapter khusus yang mengimplementasikan `RecognitionAdapter` dengan membungkus Worker `@tilawa/core`.
  - Mengisolasi seluruh interaksi `@tilawa/core` dan format pesan internal worker.
  - Pemilihan engine ada di `src/recognition/createAdapter.ts`: default 0.4.0 Zipformer; `VITE_TILAWA_ENGINE=v1` memakai jalur Tilawa 1.0 (dipakai di produksi Cloudflare) (`recognition.v1.worker.ts` + `v1Mapper.ts`) yang menghasilkan kontrak event yang sama, sehingga `ReadingSession` dan UI tidak berubah. Lihat `TILAWA_INTEGRATION.md` bagian 6. Sumber file 1.0 (`remote` atau `local`/self-host) dipilih di worker lewat `src/recognition/tilawa/v1Assets.ts`; lihat bagian 7.
- **`src/workers/`**:
  - Menjalankan inferensi ONNX melalui public API paket Tilawa di background thread: `recognition.worker.ts` (0.4.0 Zipformer2-CTC) atau `recognition.v1.worker.ts` (1.0, dengan cadangan model `lite`), sesuai `createAdapter.ts`.
- **`src/ui/`**:
  - Mengelola visual antarmuka, status anchor, Quran Reader, navigasi surat/juz/ayat, umpan balik validasi perintah suara, dan kontrol audio.
  - `QuranReader` hanya menerima `ReadingSessionSnapshot` dan `QuranContentProvider`; posisi aktif dan progress kata selalu berasal dari snapshot, bukan state UI lokal. `word_index` Tilawa (cursor zero-based) dibandingkan langsung dengan indeks kata provider yang juga zero-based, tanpa konversi: kata di cursor berstatus `current`, kata sebelum cursor atau yang ada di `matched_indices` berstatus `passed`, sisanya `upcoming`. Jika kata terakhir ayat sudah ada di `matched_indices`, seluruh ayat berstatus `passed`.
  - Auto-follow adalah perilaku presentasi di `QuranReader`: ayat aktif di-scroll halus hanya ketika posisi ayat berubah, lalu ditangguhkan sementara setelah wheel, touch, atau navigasi keyboard manual. Resume otomatis hanya meng-scroll ulang elemen ayat yang sedang dirender dan tidak pernah mengubah `ReadingSession`.
  - `QuranNavigation` hanya meneruskan referensi tervalidasi ke callback aplikasi; target tetap dimulai melalui `ReadingSession`.

---

## 3. Batas Integrasi & Isolasi Engine

1. **Tilawa Boundary**:
   - Seluruh interaksi dengan `@tilawa/core` wajib melalui `src/recognition/tilawa/`.
   - Kode sumber upstream `../tilawa/` tidak boleh diubah.
2. **Pemisahan Jalur Suara & Perintah**:
   - Pengenalan lantunan ayat Al-Qur'an (*recitation*) dilakukan oleh model Tilawa (0.4.0 Zipformer2-CTC atau 1.0; lihat `docs/TILAWA_INTEGRATION.md` bagian 0).
   - Pengenalan perintah navigasi (*voice command*) diproses melalui layer `src/command/` dan validator `src/quran/`.
   - Perintah user langsung memulai atau memindahkan `ReadingSession`; Tilawa memperbarui `detectedVerse` serta hasil `verseMatch` melalui `ReadingSession.handleEvent()`. Anchor discovery tidak berpindah ketika hasil deteksi tidak sama persis dengan target.
3. **Desain Abstraksi Recognizer Offline**:
   - Antarmuka `VoiceCommandRecognizer` memungkinkan pergantian engine STT di masa depan (Web Speech API -> Vosk WASM -> Whisper On-Device -> Android Native SpeechRecognizer) tanpa mengubah parser atau UI.

---

## 4. Strategi Multi-Platform (Web/PWA -> Android)

- **Web/PWA (Sekarang)**: `MicrophoneCapture` (Web Audio) + `TilawaAdapter`/`TilawaV1Adapter` (Web Worker + WASM) + `WebSpeechCommandRecognizer` / `TextCommandRecognizer`.
- **Android WebView / Capacitor (Percobaan, 2026-11-19)**: kode web yang sama dibungkus menjadi APK dengan model di dalam paket (`VITE_TILAWA_V1_ASSETS=local`); lihat `docs/ANDROID_APK.md`. Adapter platform native (mis. pengenal suara Android) bisa ditambahkan lewat kontrak yang sama.
- **Android / React Native (Masa Depan)**: `NativeAudioCapture` + `NativeTilawaAdapter` + `AndroidSpeechRecognizer` dengan mengimplementasikan kontrak yang sama. Seluruh dataset `src/quran/` dan parser `src/command/commandParser.ts` portabel 100% tanpa perubahan.
