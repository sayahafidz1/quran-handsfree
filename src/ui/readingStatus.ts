import type { ReadingSessionSnapshot, ReadingSessionState } from "../app/reading/ReadingSession.ts";

export interface ReadingStatusPresentation {
  label: string;
  message: string;
}

const STATE_PRESENTATIONS: Record<Exclude<ReadingSessionState, "mismatch">, ReadingStatusPresentation> = {
  idle: {
    label: "Belum dimulai",
    message: "Pilih ayat atau mulai melantunkan bacaan untuk membuka mushaf."
  },
  discovering: {
    label: "Mencari posisi",
    message: "Mencari ayat awal dari bacaan Tilawa…"
  },
  locked: {
    label: "Ayat terkunci",
    message: "Ayat ditemukan dan dikunci sebagai posisi bacaan."
  },
  tracking: {
    label: "Mengikuti bacaan",
    message: "Mengikuti ayat dan kemajuan kata dari bacaan Anda."
  },
  expecting_next: {
    label: "Menunggu ayat berikutnya",
    message: "Ayat selesai. Lanjutkan ke ayat yang diharapkan untuk memulihkan tracking."
  },
  completed: {
    label: "Selesai",
    message: "Bacaan telah mencapai akhir Al-Qur’an."
  },
};

function formatPosition(position: { surah: number; ayah: number } | null): string {
  return position ? `${position.surah}:${position.ayah}` : "posisi yang dipilih";
}

export function getReadingStatus(snapshot: ReadingSessionSnapshot): ReadingStatusPresentation {
  if (snapshot.state !== "mismatch") {
    return STATE_PRESENTATIONS[snapshot.state];
  }

  return {
    label: "Ayat tidak sesuai",
    message: `Menunggu ayat ${formatPosition(snapshot.expectedVerse)}. Terdeteksi ${formatPosition(snapshot.detectedVerse)}; posisi bacaan tetap dipertahankan.`
  };
}
