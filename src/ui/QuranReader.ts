import type { ReadingSessionSnapshot, WordProgress } from "../app/reading/ReadingSession.ts";
import { getFocusVerse } from "../app/focusVerse.ts";
import type { QuranContentProvider } from "../quran/content/index.ts";
import type { QuranAyah } from "../quran/content/types.ts";
import { getReadingStatus } from "./readingStatus.ts";
import { getWordHighlight } from "./wordHighlight.ts";

const MANUAL_SCROLL_SUSPENSION_MS = 1800;

/** Ikon bookmark di tiap ayat: apakah ayat tersimpan, dan simpan/hapus saat ikon ditekan. */
export interface ReaderBookmarks {
  has(reference: { surah: number; ayah: number }): boolean;
  toggle(reference: { surah: number; ayah: number }): void;
}

export class QuranReader {
  private activePositionKey: string | null = null;
  private resumeTimer: number | null = null;
  private autoFollowSuspendedUntil = 0;
  private lastSnapshot: ReadingSessionSnapshot | null = null;
  private bookmarks: ReaderBookmarks | null = null;

  public constructor(
    private readonly element: HTMLElement,
    private readonly statusElement: HTMLElement,
    private readonly titleElement: HTMLElement,
    private readonly stateElement: HTMLElement,
    private readonly content: QuranContentProvider
  ) {
    window.addEventListener("wheel", this.handleManualInteraction, { passive: true });
    window.addEventListener("touchstart", this.handleManualInteraction, { passive: true });
    window.addEventListener("keydown", this.handleManualKeydown);
  }

  public setBookmarks(bookmarks: ReaderBookmarks): void {
    this.bookmarks = bookmarks;
    this.refresh();
  }

  /** Menggambar ulang dengan snapshot terakhir (misalnya setelah bookmark berubah). */
  public refresh(): void {
    if (this.lastSnapshot) this.render(this.lastSnapshot);
  }

  public render(snapshot: ReadingSessionSnapshot): void {
    this.lastSnapshot = snapshot;
    const readingStatus = getReadingStatus(snapshot);
    this.stateElement.textContent = readingStatus.label;
    this.stateElement.dataset.state = snapshot.state;

    const focus = getFocusVerse(snapshot);
    const position = focus.verse;
    if (!position) {
      this.activePositionKey = null;
      this.titleElement.textContent = "Belum ada posisi bacaan";
      this.statusElement.textContent = readingStatus.message;
      this.element.replaceChildren();
      return;
    }

    const surah = this.content.getSurah(position.surah);
    const activeAyah = this.content.getAyah(position);
    if (!surah || !activeAyah) {
      this.titleElement.textContent = `Surat ${position.surah}, ayat ${position.ayah}`;
      this.statusElement.textContent = `${readingStatus.label}: Teks ayat belum tersedia.`;
      this.element.replaceChildren();
      return;
    }

    const role = focus.waiting ? "Menunggu ayat berikutnya" : snapshot.currentVerse ? "Posisi bacaan saat ini" : "Target bacaan";
    this.titleElement.textContent = `${surah.name} · ${surah.arabicName}`;
    this.statusElement.textContent = `${readingStatus.message} ${role}: ${surah.name} (${surah.number}), ayat ${position.ayah}.`;
    const wordProgress = snapshot.wordProgress
      && snapshot.wordProgress.surah === position.surah
      && snapshot.wordProgress.ayah === position.ayah
      ? snapshot.wordProgress
      : null;
    const ayahs = this.content.getAyahs(position.surah)
      .filter(({ ayah }) => ayah >= position.ayah - 1 && ayah <= position.ayah + 1);
    this.element.replaceChildren(...ayahs.map((ayah) => this.createAyah(ayah, position.ayah, wordProgress, position.surah, snapshot.skippedWords[`${position.surah}:${ayah.ayah}`] ?? [])));

    const positionKey = `${position.surah}:${position.ayah}`;
    if (positionKey !== this.activePositionKey) {
      this.activePositionKey = positionKey;
      this.followCurrentAyah();
    } else {
      this.followCurrentWordIfNeeded();
    }
  }

  public dispose(): void {
    window.removeEventListener("wheel", this.handleManualInteraction);
    window.removeEventListener("touchstart", this.handleManualInteraction);
    window.removeEventListener("keydown", this.handleManualKeydown);
    if (this.resumeTimer !== null) {
      window.clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
  }

  private readonly handleManualInteraction = (): void => {
    this.autoFollowSuspendedUntil = Date.now() + MANUAL_SCROLL_SUSPENSION_MS;
    if (this.resumeTimer !== null) window.clearTimeout(this.resumeTimer);
    this.resumeTimer = window.setTimeout(() => {
      this.resumeTimer = null;
      this.followCurrentAyah();
    }, MANUAL_SCROLL_SUSPENSION_MS);
  };

  private readonly handleManualKeydown = (event: KeyboardEvent): void => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) {
      this.handleManualInteraction();
    }
  };

  private followCurrentAyah(): void {
    if (Date.now() < this.autoFollowSuspendedUntil) return;
    const currentAyah = this.element.querySelector<HTMLElement>(".reader-ayah.current");
    currentAyah?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  private followCurrentWordIfNeeded(): void {
    if (Date.now() < this.autoFollowSuspendedUntil) return;
    const currentWord = this.element.querySelector<HTMLElement>(".quran-word-current");
    if (!currentWord) return;
    const bounds = currentWord.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
      currentWord.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  private createBookmarkButton(surah: number, ayah: number): HTMLButtonElement {
    const reference = { surah, ayah };
    const saved = this.bookmarks!.has(reference);
    const button = document.createElement("button");
    button.type = "button";
    button.className = saved ? "ayah-bookmark saved" : "ayah-bookmark";
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-label", `${saved ? "Hapus" : "Simpan"} bookmark ayat ${surah}:${ayah}`);
    button.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="${saved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>`;
    button.addEventListener("click", () => this.bookmarks!.toggle(reference));
    return button;
  }

  private createAyah(ayah: QuranAyah, activeAyah: number, progress: WordProgress | null, surah: number, skipped: readonly number[]): HTMLElement {
    const article = document.createElement("article");
    article.className = ayah.ayah === activeAyah ? "reader-ayah current" : "reader-ayah";
    article.setAttribute("aria-current", ayah.ayah === activeAyah ? "true" : "false");
    article.setAttribute("dir", "rtl");
    const text = document.createElement("p");
    text.className = "arabic-text";
    ayah.words.forEach((word, index) => {
      if (index > 0) text.append(" ");
      const wordElement = document.createElement("span");
      const highlight = ayah.ayah === activeAyah ? getWordHighlight(word, progress, skipped, progress === null) : getWordHighlight(word, null, skipped);
      wordElement.className = `quran-word quran-word-${highlight}`;
      wordElement.dataset.wordIndex = String(word.index);
      wordElement.textContent = word.text;
      if (highlight === "current") wordElement.setAttribute("aria-current", "true");
      if (highlight === "skipped") wordElement.title = "Kata ini terlewat";
      text.append(wordElement);
    });
    const number = document.createElement("span");
    number.className = "ayah-number";
    number.dir = "ltr";
    number.textContent = String(ayah.ayah);
    const side = document.createElement("div");
    side.className = "ayah-side";
    side.dir = "ltr";
    side.append(number);
    if (this.bookmarks) side.append(this.createBookmarkButton(surah, ayah.ayah));
    article.append(text, side);
    return article;
  }
}
