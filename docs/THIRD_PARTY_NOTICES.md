# Pemberitahuan Pihak Ketiga (Third-Party Notices)

Dokumen ini mencatat lisensi, atribusi, dan hak cipta dari perangkat lunak serta komponen pihak ketiga yang digunakan dalam proyek `quran-handsfree`.

---

## 1. Tilawa

**Attribution:**
> Quran recognition powered by Tilawa.

Tilawa dikembangkan oleh **yazinsai** dan digunakan sebagai upstream recognition engine melalui paket `@tilawa/core`. Kode sumber Tilawa dilisensikan di bawah **MIT License**.

```text
MIT License

Copyright (c) 2026 yazinsai

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 2. Model dan Korpus Fonem Zipformer

`public/tilawa/zipformer_a0w_ep1_a05.int8.onnx` dan
`public/tilawa/zipformer_quran.json` berasal dari rilis resmi Tilawa dan
merupakan derivative dari pekerjaan Quran-Lab. Keduanya dilisensikan di bawah
**Quran-Lab No-Profit License 1.2 (NPL-1.2)**, bukan MIT. Lisensi tersebut
melarang penggunaan komersial dan mensyaratkan distribusi share-alike. File
lisensi resmi `NPL-1.2.txt` disediakan oleh script setup bersama aset.

I/O manifest model (`zipformer_a0w_ep1_a05.io.json`) berasal dari rilis model
yang sama. `quran.json` adalah data teks display opsional dari rilis Tilawa
v0.2.0; aset UI utama tetap `public/quran/content.json`. Pertahankan atribusi
upstream dan verifikasi ketentuan lisensi sebelum mendistribusikan aplikasi.
Versi sumber, ukuran, dan SHA-256 aset tercatat di
[`public/tilawa/README.md`](../public/tilawa/README.md).

---

## 3. ONNX Runtime Web

- `onnxruntime-web` digunakan untuk menjalankan inferensi model ONNX di sisi klien/browser.
- Dilisensikan di bawah **MIT License** oleh Microsoft Corporation.

---

## 4. Tilawa 1.0

- **Kode**: `@tilawa/core` 1.0.0-rc.0 (MIT) dipasang sebagai alias `tilawa-v1`.
- **Model**: bobot `spliced-clean` (full) dan `spliced-clean-lite` berlisensi **CC BY 4.0** (model card upstream: "Credit 'Tilawa (tilawa.dev)' and the sources above when you redistribute them"). Berbeda dari NPL-1.2 untuk Zipformer 0.4.0. Model dipakai **tanpa perubahan**. Tautan lisensi: https://creativecommons.org/licenses/by/4.0/
- **Sumber yang atribusinya ikut berlaku** (menurut `NOTICE.md` upstream): tlog (`tarteel-ai/tlog`, Tarteel, CC-BY), Quranic Universal Ayahs (QUD Technologies, CC-BY), muaalem (MIT), quran-transcript (MIT), k2-fsa icefall (Apache-2.0), ONNX Runtime (MIT), dan Tanzil (teks Uthmani rujukan; Tanzil meminta teks direproduksi apa adanya, dikreditkan ke Tanzil, dengan tautan ke https://tanzil.net).
- **Di mana atribusi ditampilkan**: layar "Tentang & Lisensi" di aplikasi (`index.html`), `public/tilawa-v1/ATTRIBUTION.txt` (ikut terkemas bersama build), serta `NOTICE.md` dan `LICENSE.txt` paket yang disalin `npm run setup:v1` ke `public/tilawa-v1/`. Untuk APK, pastikan layar Tentang & Lisensi tetap ada dan berkas-berkas itu ikut di dalam paket.
- **Sumber file saat berjalan**: mode `remote` (bawaan) memuat model dari `tilawa.dev` dan WASM dari jsDelivr; mode `local` memuat semuanya dari aplikasi sendiri (lihat `TILAWA_INTEGRATION.md` bagian 6).
- Verifikasi teks `NOTICE.md` paket setelah `npm install` sebelum distribusi publik; ringkasan di atas disusun dari salinan upstream yang dibaca, bukan dari paket yang terpasang.
