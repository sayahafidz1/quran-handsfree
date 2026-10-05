# Aset Runtime Tilawa

Folder ini diperuntukkan untuk menyimpan berkas aset model dan konfigurasi Tilawa yang dibutuhkan oleh Web Worker saat menjalankan inferensi pengenalan ayat di perangkat lokal.

> **PENTING**: File biner model dan dataset berukuran besar sengaja diabaikan oleh Git (`.gitignore`) agar ukuran repository tetap ramping.

---

## Berkas yang Disiapkan

Jalankan `npm run setup` dari direktori aplikasi untuk mengambil berkas berikut
secara otomatis ke folder ini:

| Berkas | Sumber resmi | Ukuran | SHA-256 |
| --- | --- | ---: | --- |
| `zipformer_a0w_ep1_a05.int8.onnx` | Tilawa `zipformer-a0w-ep1-a0.5` (default model `@tilawa/core` 0.4.0) | 69,246,033 | `bfb5b712695634a6099b45a6a78003bd5103417c4eae6338277d54679254905a` |
| `zipformer_a0w_ep1_a05.io.json` | Tilawa `zipformer-a0w-ep1-a0.5` | 26,867 | `7dca1dafd6ee26044a0d3ba6b9483278203f55df7cc95d40cda865183a0d797e` |
| `zipformer_quran.json` | Tilawa `v0.3.0` | 5,453,439 | `24360c05ec88fcacf3419c1fe6cd81d69e653326a0bf0e4fb507e7b98fc88127` |
| `quran.json` | Tilawa `v0.2.0` (teks Arab opsional untuk event `verse_match`) | 3,186,385 | `6e6f31f642c701b49a1ba090311ca4c7a97c6a5b79a302712dff815a9d7b3d03` |
| `NPL-1.2.txt` | Tilawa `v0.3.0` | 7,041 | `77526bdbfac94132e5114c3a34492c33f915e4b7f310f00b9995500d3610cab5` |

Core `0.4.0` menyertakan I/O manifest default-nya; manifest resmi model tetap
diunduh agar pasangan model/kontrak I/O tersedia eksplisit dan dapat diverifikasi.
Korpus fonem model Zipformer berbeda dari aset FastConformer. File `vocab.json`,
`quran_ctc_tokens.json`, `fastconformer_full_mixed.onnx`, dan metadata ekspor
FastConformer tidak digunakan oleh setup Zipformer.

---

## Aturan Pengelolaan Aset
- **Pin Versi & Checksum**: Versi sumber setiap file dipatok di setup script; seluruh berkas diverifikasi berdasarkan ukuran dan SHA-256 yang tercantum di atas.
- **Jangan Mengubah Upstream**: Dilarang memodifikasi atau menyalin berkas dari `../../tilawa/` secara sembarangan.
- **Lisensi & Hak Distribusi**: Model dan korpus fonem Zipformer tunduk pada NPL-1.2 (non-komersial dan share-alike); pertahankan file lisensinya dan lihat `../../docs/THIRD_PARTY_NOTICES.md`.
