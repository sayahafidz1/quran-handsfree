# Tujuan Proyek (Goals)

## 1. Visi Produk
Menyediakan pengalaman hands-free yang mulus dan intuitif bagi pengguna untuk membaca atau melantunkan ayat suci Al-Qur'an, dengan pengenalan bacaan dan perintah suara navigasi berbasis AI yang berjalan sepenuhnya di perangkat lokal pengguna (on-device / offline).

## 2. Arah Platform & Fase Rilis
- **Fase 1 (Saat Ini): Web/PWA First**
  - Implementasi scaffold arsitektur terpisah, pipeline audio Web API, isolasi Web Worker, dan adapter `@tilawa/core`.
  - Subsistem navigasi perintah suara (*Voice Command Navigation*) & penentuan posisi awal (*Anchor Position*) tanpa memodifikasi upstream Tilawa.
  - Kemampuan offline penuh menggunakan caching Service Worker setelah aset model diunduh.
- **Fase 2 (Masa Depan): Android (React Native / Native APK)**
  - Mengadopsi arsitektur modular yang sama dengan mengganti adapter platform (misal native audio capture, native ONNX runtime, dan Android SpeechRecognizer) tanpa mengubah product logic utama aplikasi.

## 3. Sasaran Tahap Ini (Fondasi & Struktur Arsitektur)
- Proyek `quran-handsfree/` berdiri sendiri sebagai aplikasi terpisah dari upstream `tilawa/`.
- Memisahkan boundary integrasi `@tilawa/core` di `src/recognition/tilawa/`.
- Memisahkan boundary perintah suara navigasi di `src/command/` dan validasi Al-Qur'an di `src/quran/`.
- Memastikan public API `@tilawa/core` digunakan secara bersih tanpa duplikasi kode source.
- Merapikan struktur folder (`app`, `audio`, `command`, `quran`, `recognition/tilawa`, `workers`, `ui`).
- Menyediakan abstraction layer `VoiceCommandRecognizer` & `AnchorCoordinator` untuk mendukung pengenalan offline on-device di masa depan.

## 4. Status Implementasi Navigasi Perintah Suara
- Navigasi posisi awal melalui teks/perintah suara telah tersedia di `src/command/`: parser memetakan nama atau nomor 114 surat dan nomor ayat menjadi pasangan tervalidasi `{ surah, ayah }`.
- `AnchorCoordinator` menyatukan hasil perintah dengan discovery bacaan Tilawa sebagai *locked position*, tanpa mengubah upstream Tilawa.
- Implementasi `WebSpeechCommandRecognizer` saat ini adalah adapter browser yang dapat diganti. Parser, data surat, dan kontrak `VoiceCommandRecognizer` tetap lokal; engine STT offline penuh (misalnya Vosk/Whisper WASM atau native Android) masih merupakan backlog.

## 5. Backlog & Fitur yang Sengaja Belum Diimplementasikan (Non-Goals)
Fitur-fitur berikut **belum diimplementasikan** pada tahap ini dan berada dalam backlog terencana:
1. **Fitur Verifier (Penguji Ketepatan Bacaan & Tajwid)**:
   - Validasi ketepatan pelafalan ayat kata demi kata (*word-by-word accuracy validation*) serta koreksi hukum tajwid.
   - Evaluasi makhraj dan harakat lanjutan.
2. **On-Device Offline STT Model Engine (Vosk-WASM / Whisper-WASM)**:
   - Penggantian recognizer suara peramban (*browser SpeechRecognition*) dengan engine STT biner lokal/WASM untuk offline absolut tanpa ketergantungan kapabilitas browser.
3. **State Machine Logika Produk Hands-Free Lanjutan**:
   - Alur `discovery / command anchor -> locked position -> verify -> auto-advance next ayah` yang akan diorkestrasi di layer `src/app/` / domain logic.
4. **Antarmuka Mushaf Penuh**:
   - Tampilan mushaf digital interaktif bergaya Madinah/Kemenag, bookmark, transliterasi Latin, dan terjemahan bahasa Indonesia.
5. **Porting Android Native / React Native**:
   - Native audio bridge (Oboe / AudioRecord) dan native ONNX runtime.
