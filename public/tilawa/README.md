# Aset Runtime Tilawa

Folder ini diperuntukkan untuk menyimpan berkas aset model dan konfigurasi Tilawa yang dibutuhkan oleh Web Worker saat menjalankan inferensi pengenalan ayat di perangkat lokal.

> **PENTING**: File biner model dan dataset berukuran besar sengaja diabaikan oleh Git (`.gitignore`) agar ukuran repository tetap ramping.

---

## Berkas yang Dibutuhkan

Unduh berkas-berkas berikut dari rilis resmi Tilawa yang versinya dipin dan letakkan di folder ini:

1. `fastconformer_full_mixed.onnx` — Model neural network FastConformer ONNX (~88 MB).
2. `vocab.json` — Mapping token CTC ke karakter Arab.
3. `quran_ctc_tokens.json` — Tokenisasi CTC ayat Al-Qur'an.
4. `quran.json` — Dataset teks dan metadata surat/ayat.
5. `export_metadata.json` — Metadata rilis resmi dan informasi hash SHA-256.

---

## Aturan Pengelolaan Aset
- **Pin Versi & Checksum**: Setiap berkas aset wajib berasal dari satu tag rilis yang sama dan diverifikasi nilai hash SHA-256 miliknya.
- **Jangan Mengubah Upstream**: Dilarang memodifikasi atau menyalin berkas dari `../../tilawa/` secara sembarangan.
- **Lisensi & Hak Distribusi**: Pertahankan kepatuhan terhadap lisensi dan atribusi rilis model (lihat `../../docs/THIRD_PARTY_NOTICES.md`).
