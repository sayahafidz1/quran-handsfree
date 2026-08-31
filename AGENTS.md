# Petunjuk & Aturan Pengembang (Agent Guidelines)

Dokumen ini adalah aturan mutlak dan panduan kerja untuk setiap AI coding agent atau engineer yang mengerjakan proyek `quran-handsfree`.

---

## 1. Dokumen yang Wajib Dibaca Sebelum Bekerja
1. `docs/PROJECT_CONTEXT.md` — Konteks status dan riwayat hidup proyek.
2. `docs/ARCHITECTURE.md` — Prinsip desain arsitektur, layer, dan batas integrasi.
3. `docs/DECISIONS.md` — Riwayat keputusan arsitektur (ADR).
4. `docs/GOALS.md` — Batasan cakupan fitur dan backlog yang belum boleh dibuat.
5. `docs/TILAWA_INTEGRATION.md` — Spesifikasi integrasi `@tilawa/core` dan manajemen aset.
6. `docs/NEXT_STEPS.md` — Rencana tindak lanjut pengembangan.

---

## 2. Batasan Mutlak (Hard Constraints)

1. **Folder Upstream `../tilawa/` Tidak Boleh Dimodifikasi**:
   - `tilawa/` adalah clone upstream yang bertindak murni sebagai referensi dan engine pengenalan.
   - Jangan mengubah, mengedit, menghapus, atau menambah berkas apa pun di folder `../tilawa/`.
2. **Semua Pekerjaan Dilakukan di `quran-handsfree/`**:
   - Seluruh kode aplikasi, UI, konfigurasi, dan dokumentasi harus berada di dalam `quran-handsfree/`.
3. **Integration Boundary di `src/recognition/tilawa/`**:
   - `src/recognition/tilawa/` adalah adapter / boundary isolasi antara aplikasi dan `@tilawa/core`.
   - Gunakan selalu public API dari paket `@tilawa/core`.
   - Dilarang mengimpor file internal source Tilawa secara langsung.
   - Dilarang menyalin (copy-paste) source code Tilawa ke dalam proyek ini kecuali terdapat kendala teknis yang mutlak tidak dapat dihindari dan telah disetujui.
4. **Pemisahan Product Logic**:
   - Logika bisnis produk seperti `discovery -> lock -> verify -> next ayah` **dilarang keras** dicampur ke dalam adapter Tilawa (`src/recognition/tilawa/`). Logika tersebut harus berada di layer aplikasi/domain (`src/app/`).
5. **Portabilitas Arsitektur (Web/PWA & Android)**:
   - Pastikan abstraksi pengenalan (`src/recognition/`) tetap bersih agar dapat mendukung Web/PWA saat ini dan React Native / Android native di masa depan tanpa mengubah core product logic.
6. **Manajemen Aset Model di `public/tilawa/`**:
   - Jangan menyimpan file model ONNX atau dataset biner Tilawa berukuran besar ke dalam Git.
   - Setiap aset runtime di `public/tilawa/` wajib dipin versinya serta dicatat nilai checksum SHA-256 pada dokumentasi rilis/manifest.
7. **Disiplin Dokumentasi Berkelanjutan**:
   - Setiap perubahan arsitektur penting, perubahan struktur folder, atau penambahan adapter **wajib** didokumentasikan di file `.md` yang relevan (`README.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `PROJECT_CONTEXT.md`, dll.) pada commit/perubahan yang sama agar agent berikutnya memahami konteks dan keputusan sebelumnya.

---

## 3. Prosedur Verifikasi
Sebelum menyelesaikan pekerjaan:
1. Pastikan TypeScript memeriksa tipe dengan benar tanpa error:
   ```bash
   npx tsc --noEmit
   ```
2. Pastikan build aplikasi berhasil:
   ```bash
   npm run build
   ```
