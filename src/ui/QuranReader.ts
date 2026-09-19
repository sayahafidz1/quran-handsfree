import type { ReadingSessionSnapshot, WordProgress } from "../app/reading/ReadingSession.ts";
import type { QuranContentProvider } from "../quran/content/index.ts";
import type { QuranAyah } from "../quran/content/types.ts";
import { getReadingStatus } from "./readingStatus.ts";
import { getWordHighlight } from "./wordHighlight.ts";

const MANUAL_SCROLL_SUSPENSION_MS = 1800;

export class QuranReader {
  private activePositionKey: string | null = null;
  private resumeTimer: number | null = null;
  private autoFollowSuspendedUntil = 0;

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

  public render(snapshot: ReadingSessionSnapshot): void {
    const readingStatus = getReadingStatus(snapshot);
    this.stateElement.textContent = readingStatus.label;
    this.stateElement.dataset.state = snapshot.state;

    const position = snapshot.currentVerse ?? snapshot.expectedVerse;
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

    const role = snapshot.currentVerse ? "Posisi bacaan saat ini" : "Target bacaan";
    this.titleElement.textContent = `${surah.name} · ${surah.arabicName}`;
    this.statusElement.textContent = `${readingStatus.message} ${role}: ${surah.name} (${surah.number}), ayat ${position.ayah}.`;
    const wordProgress = snapshot.wordProgress
      && snapshot.wordProgress.surah === position.surah
      && snapshot.wordProgress.ayah === position.ayah
      ? snapshot.wordProgress
      : null;
    const ayahs = this.content.getAyahs(position.surah)
      .filter(({ ayah }) => ayah >= position.ayah - 1 && ayah <= position.ayah + 1);
    this.element.replaceChildren(...ayahs.map((ayah) => this.createAyah(ayah, position.ayah, wordProgress)));

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

  private createAyah(ayah: QuranAyah, activeAyah: number, progress: WordProgress | null): HTMLElement {
    const article = document.createElement("article");
    article.className = ayah.ayah === activeAyah ? "reader-ayah current" : "reader-ayah";
    article.setAttribute("aria-current", ayah.ayah === activeAyah ? "true" : "false");
    article.setAttribute("dir", "rtl");
    const text = document.createElement("p");
    text.className = "arabic-text";
    ayah.words.forEach((word, index) => {
      if (index > 0) text.append(" ");
      const wordElement = document.createElement("span");
      const highlight = ayah.ayah === activeAyah ? getWordHighlight(word, progress) : "upcoming";
      wordElement.className = `quran-word quran-word-${highlight}`;
      wordElement.dataset.wordIndex = String(word.index);
      wordElement.textContent = word.text;
      if (highlight === "current") wordElement.setAttribute("aria-current", "true");
      text.append(wordElement);
    });
    const number = document.createElement("span");
    number.className = "ayah-number";
    number.dir = "ltr";
    number.textContent = String(ayah.ayah);
    article.append(text, number);
    return article;
  }
}
