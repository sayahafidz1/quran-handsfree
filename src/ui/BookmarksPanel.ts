import type { BookmarkStore } from "../app/bookmarks.ts";
import type { AyahReference, QuranContentProvider } from "../quran/content/index.ts";
import { getSurahInfo } from "../quran/index.ts";

export function formatReferenceLabel(reference: AyahReference): string {
  const info = getSurahInfo(reference.surah);
  return `${info ? info.name : `Surat ${reference.surah}`} ${reference.surah}:${reference.ayah}`;
}

/** Kartu bookmark manual dan "terakhir dibaca". Logika penyimpanan ada di `BookmarkStore`. */
export class BookmarksPanel {
  private readonly resumeButton: HTMLButtonElement;
  private readonly lastReadCard: HTMLElement;
  private readonly lastReadTitle: HTMLElement;
  private readonly listElement: HTMLElement;
  private readonly feedback: HTMLElement;

  public constructor(
    root: HTMLElement,
    private readonly store: BookmarkStore,
    private readonly content: QuranContentProvider,
    private readonly onOpen: (reference: AyahReference) => void,
    private readonly onChange?: () => void
  ) {
    this.resumeButton = root.querySelector<HTMLButtonElement>("#bookmark-resume")!;
    this.lastReadCard = root.querySelector<HTMLElement>("#last-read-card")!;
    this.lastReadTitle = root.querySelector<HTMLElement>("#last-read-title")!;
    this.listElement = root.querySelector<HTMLElement>("#bookmark-list")!;
    this.feedback = root.querySelector<HTMLElement>("#bookmark-feedback")!;

    this.resumeButton.addEventListener("click", () => {
      const lastRead = this.store.getLastRead();
      if (lastRead) this.open(lastRead);
    });
    this.render();
  }

  /** Dipanggil saat ayat bacaan terdeteksi berubah (bukan saat hanya dibuka manual). */
  public noteReading(reference: AyahReference): void {
    this.store.setLastRead(reference);
    this.renderResume();
  }

  /** Daftar digambar ulang setelah bookmark berubah dari luar (ikon di layar baca). */
  public refresh(): void {
    this.renderList();
  }

  private open(reference: AyahReference): void {
    if (!this.content.getAyah(reference)) {
      this.showFeedback("Ayat ini tidak tersedia.", "error");
      return;
    }
    this.showFeedback(`Dibuka: ${formatReferenceLabel(reference)}`, "success");
    this.onOpen(reference);
  }

  private render(): void {
    this.renderResume();
    this.renderList();
  }

  private renderResume(): void {
    const lastRead = this.store.getLastRead();
    this.lastReadCard.hidden = !lastRead;
    this.lastReadTitle.textContent = lastRead ? formatReferenceLabel(lastRead) : "";
    this.resumeButton.setAttribute(
      "aria-label",
      lastRead ? `Lanjutkan terakhir dibaca: ${formatReferenceLabel(lastRead)}` : "Lanjutkan terakhir dibaca"
    );
  }

  private renderList(): void {
    const items = this.store.list();
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Belum ada bookmark. Tekan ikon bookmark pada sebuah ayat saat membaca.";
      this.listElement.replaceChildren(empty);
      return;
    }
    this.listElement.replaceChildren(...items.map((reference) => {
      const row = document.createElement("div");
      row.className = "bookmark-row";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "bookmark-open";
      open.textContent = formatReferenceLabel(reference);
      open.addEventListener("click", () => this.open(reference));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "bookmark-remove";
      remove.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>';
      remove.setAttribute("aria-label", `Hapus bookmark ${formatReferenceLabel(reference)}`);
      remove.addEventListener("click", () => {
        this.store.remove(reference);
        this.showFeedback(`Bookmark dihapus: ${formatReferenceLabel(reference)}`, "info");
        this.renderList();
        this.onChange?.();
      });
      row.append(open, remove);
      return row;
    }));
  }

  private showFeedback(message: string, kind: "success" | "error" | "info"): void {
    this.feedback.textContent = message;
    this.feedback.className = `feedback-msg ${kind}`;
  }
}
