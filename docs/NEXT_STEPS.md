# Langkah Pengembangan Berikutnya (Next Steps)

Dokumen ini memuat peta jalan dan urutan pengerjaan untuk tahap selanjutnya dari proyek `quran-handsfree`.

---

## 1. Pengadaan & Verifikasi Aset Tilawa
- Buat file manifest aset (`public/tilawa/export_metadata.json` atau manifest khusus) yang mencantumkan tag rilis dan hash SHA-256 tiap file aset.
- Unduh model ONNX dan token JSON untuk pengujian end-to-end lokal.

## 2. Peningkatan Pipeline Audio (`AudioWorklet`)
- Ganti implementasi `ScriptProcessorNode` di `src/audio/MicrophoneCapture.ts` dengan `AudioWorkletNode` standar modern agar penangkapan dan resampling audio tidak terganggu aktivitas thread utama.
- Tetap pertahankan kontrak antarmuka luar `onSamples(Float32Array)`.

## 3. State Machine Logika Produk (Stage 1 Selesai)
- `src/app/reading/ReadingSession.ts` mengorkestrasi discovery, lock, follow-along melalui `word_progress`, mismatch, dan auto-advance ke ayat berikutnya.
- Discovery langsung dapat memulai sesi ketika belum ada target manual; command manual tetap memasok target yang harus dicocokkan.
- Logika ini berada di layer `src/app/`, terpisah dari adapter `src/recognition/tilawa/`.

## 4. Fitur Backlog (Tahap Lanjutan)
1. **Fitur Verifier**: Evaluasi ketepatan makhraj/bacaan per kata.
2. **Fitur Voice Command**: Navigasi hands-free berbasis perintah suara ("surat berikutnya", "baca ulang").
3. **Komponen UI Mushaf**: Antarmuka mushaf digital dengan penyorotan kata aktif (*active word highlight*).
4. **Strategi Caching PWA**: Optimasi penyimpanan aset model besar (~88 MB) di IndexedDB / Cache Storage dengan indikator progres unduhan yang elegan.
5. **Porting Android Native / React Native**: Mengganti adapter Web Audio dan Web Worker dengan native bridge tanpa merusak logika aplikasi.
