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

## 2. Model, Bobot Neural Network, & Dataset Quran

- File model ONNX (`fastconformer_full_mixed.onnx`), token CTC (`quran_ctc_tokens.json`), vocabulary (`vocab.json`), serta metadata Quran yang diunduh ke `public/tilawa/` mungkin tunduk pada ketentuan lisensi atau atribusi data terpisah dari source code pustaka.
- Setiap pengembang dan distributor wajib mempertahankan atribusi asal, dokumentasi lisensi, serta memverifikasi kesesuaian hak distribusi dari rilis model terkait.

---

## 3. ONNX Runtime Web

- `onnxruntime-web` digunakan untuk menjalankan inferensi model ONNX di sisi klien/browser.
- Dilisensikan di bawah **MIT License** oleh Microsoft Corporation.
