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
│ - TilawaAdapter (BOUNDARY)    │           │ - Ekstraksi Surat & Nomor Ayat│
│ - Isolasi @tilawa/core        │           │ - Parser Angka Kata Bahasa ID │
└───────────────┬───────────────┘           └───────────────┬───────────────┘
                │ Worker RPC                                │
                ▼                                           ▼
┌───────────────────────────────┐           ┌───────────────────────────────┐
│ src/workers/recognition.worker│           │ src/quran/validator.ts        │
│ - onnxruntime-web (WASM)      │           │ - Metadata 114 Surat & Ayah   │
│ - Tilawa FastConformer + CTC  │           │ - Validasi Batas & Alias Surat│
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
  - `handleRecognitionEvent()` meneruskan `verse_match` dan `word_progress` hanya ke `ReadingSession.handleEvent()`. UI membaca snapshot sesi.
- **`src/audio/`**:
  - Bertanggung jawab penuh atas penangkapan audio perangkat keras dan resample ke format standar 16 kHz Float32.
- **`src/command/`**:
  - **`types.ts`**: Kontrak antarmuka `VoiceCommandRecognizer`, `NavigationCommand`, dan `ParseCommandResult`.
  - **`numberParser.ts`**: Parser angka kata bahasa Indonesia (e.g. *"dua ratus lima puluh lima"* -> `255`, *"lima puluh delapan"* -> `58`, *"sepuluh"* -> `10`) dan angka digit.
  - **`commandParser.ts`**: Engine pemetaan pola perintah navigasi bebas (e.g. *"Al-Baqarah ayat 255"*, *"Surat Yasin ayat 58"*, *"Al-Kahfi ayat 10"*, *"Surat 2 ayat 255"*).
  - **`recognizers/`**: Implementasi recognizer yang dapat diganti (*pluggable*), seperti `WebSpeechCommandRecognizer` dan `TextCommandRecognizer`.
- **`src/quran/`**:
  - **`surahData.ts`**: Data 114 surat Al-Qur'an lengkap dengan nama latin, nama arab, batas jumlah ayat yang akurat, serta kamus alias/variasi pelafalan.
  - **`validator.ts`**: Logika pencarian alias dan validasi batas ayat Al-Qur'an murni *offline* tanpa ketergantungan luar.
  - **`navigation.ts`**: Menghitung referensi ayat berikutnya, termasuk perpindahan ke awal surat berikutnya dan akhir Al-Qur'an.
- **`src/recognition/` & `src/recognition/tilawa/` (Integration Boundary)**:
  - Adapter khusus yang mengimplementasikan `RecognitionAdapter` dengan membungkus Worker `@tilawa/core`.
  - Mengisolasi seluruh interaksi `@tilawa/core` dan format pesan internal worker.
- **`src/workers/`**:
  - Menjalankan inferensi ONNX FastConformer dan CTC decoding Tilawa di background thread.
- **`src/ui/`**:
  - Mengelola visual antarmuka, status anchor, umpan balik validasi perintah suara, dan kontrol audio.

---

## 3. Batas Integrasi & Isolasi Engine

1. **Tilawa Boundary**:
   - Seluruh interaksi dengan `@tilawa/core` wajib melalui `src/recognition/tilawa/`.
   - Kode sumber upstream `../tilawa/` tidak boleh diubah.
2. **Pemisahan Jalur Suara & Perintah**:
   - Pengenalan lantunan ayat Al-Qur'an (*recitation*) dilakukan oleh model Tilawa FastConformer.
   - Pengenalan perintah navigasi (*voice command*) diproses melalui layer `src/command/` dan validator `src/quran/`.
   - Perintah user langsung memulai atau memindahkan `ReadingSession`; Tilawa memperbarui `detectedVerse` serta hasil `verseMatch` melalui `ReadingSession.handleEvent()`. Anchor discovery tidak berpindah ketika hasil deteksi tidak sama persis dengan target.
3. **Desain Abstraksi Recognizer Offline**:
   - Antarmuka `VoiceCommandRecognizer` memungkinkan pergantian engine STT di masa depan (Web Speech API -> Vosk WASM -> Whisper On-Device -> Android Native SpeechRecognizer) tanpa mengubah parser atau UI.

---

## 4. Strategi Multi-Platform (Web/PWA -> Android)

- **Web/PWA (Sekarang)**: `MicrophoneCapture` (Web Audio) + `TilawaAdapter` (Web Worker + WASM) + `WebSpeechCommandRecognizer` / `TextCommandRecognizer`.
- **Android / React Native (Masa Depan)**: `NativeAudioCapture` + `NativeTilawaAdapter` + `AndroidSpeechRecognizer` dengan mengimplementasikan kontrak yang sama. Seluruh dataset `src/quran/` dan parser `src/command/commandParser.ts` portabel 100% tanpa perubahan.
