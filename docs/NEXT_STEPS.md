# Langkah Pengembangan Berikutnya (Next Steps)

Dokumen ini memuat peta jalan dan urutan pengerjaan untuk tahap selanjutnya dari proyek `quran-handsfree`.

---

## 1. Pengadaan & Verifikasi Aset Tilawa
- Buat file manifest aset (`public/tilawa/export_metadata.json` atau manifest khusus) yang mencantumkan tag rilis dan hash SHA-256 tiap file aset.
- Unduh model ONNX dan token JSON untuk pengujian end-to-end lokal.

## 2. Peningkatan Pipeline Audio (`AudioWorklet`)
- Ganti implementasi `ScriptProcessorNode` di `src/audio/MicrophoneCapture.ts` dengan `AudioWorkletNode` standar modern agar penangkapan dan resampling audio tidak terganggu aktivitas thread utama.
- Tetap pertahankan kontrak antarmuka luar `onSamples(Float32Array)`.

## 3. Desain & Implementasi State Machine Logika Produk
- Bangun modul alur hands-free di layer `src/app/`:
  - **Discovery**: Mendengarkan ayat apa pun yang sedang dibaca pengguna.
  - **Lock**: Mengunci konteks surat dan ayat yang terdeteksi.
  - **Verify / Follow-along**: Memantau kemajuan kata demi kata (`word_progress`).
  - **Next Ayah**: Secara otomatis berpindah ke ayat berikutnya ketika ayat saat ini selesai dilantunkan.
- Pastikan logika ini tidak masuk ke dalam adapter `src/recognition/tilawa/`.

## 4. Fitur Backlog (Tahap Lanjutan)
1. **Fitur Verifier**: Evaluasi ketepatan makhraj/bacaan per kata.
2. **Fitur Voice Command**: Navigasi hands-free berbasis perintah suara ("surat berikutnya", "baca ulang").
3. **Komponen UI Mushaf**: Antarmuka mushaf digital dengan penyorotan kata aktif (*active word highlight*).
4. **Strategi Caching PWA**: Optimasi penyimpanan aset model besar (~88 MB) di IndexedDB / Cache Storage dengan indikator progres unduhan yang elegan.
5. **Porting Android Native / React Native**: Mengganti adapter Web Audio dan Web Worker dengan native bridge tanpa merusak logika aplikasi.
