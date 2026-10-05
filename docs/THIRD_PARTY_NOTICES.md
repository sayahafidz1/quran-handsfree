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
