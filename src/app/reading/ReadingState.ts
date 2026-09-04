import type { SelectedVerse } from "../../command/types.ts";

export interface ReadingStateSnapshot {
  selectedVerse: SelectedVerse | null;
  expectedVerse: SelectedVerse | null;
  detectedVerse: SelectedVerse | null;
  verseMatch: boolean | null;
  wordProgress: WordProgress | null;
}

export type ReadingStateListener = (state: ReadingStateSnapshot) => void;

export interface WordProgress {
  surah: number;
  ayah: number;
  wordIndex: number;
  totalWords: number;
}

export class ReadingState {
  private selectedVerse: SelectedVerse | null = null;
  private expectedVerse: SelectedVerse | null = null;
  private detectedVerse: SelectedVerse | null = null;
  private verseMatch: boolean | null = null;
  private wordProgress: WordProgress | null = null;
  private readonly listeners = new Set<ReadingStateListener>();

  public getState(): ReadingStateSnapshot {
    return {
      selectedVerse: this.copyVerse(this.selectedVerse),
      expectedVerse: this.copyVerse(this.expectedVerse),
      detectedVerse: this.copyVerse(this.detectedVerse),
      verseMatch: this.verseMatch,
      wordProgress: this.copyWordProgress(this.wordProgress)
    };
  }

  public getSelectedVerse(): SelectedVerse | null {
    return this.copyVerse(this.selectedVerse);
  }

  public getExpectedVerse(): SelectedVerse | null {
    return this.copyVerse(this.expectedVerse);
  }

  public getDetectedVerse(): SelectedVerse | null {
    return this.copyVerse(this.detectedVerse);
  }

  public getVerseMatch(): boolean | null {
    return this.verseMatch;
  }

  public selectVerse(verse: SelectedVerse): void {
    this.selectedVerse = { ...verse };
    this.expectedVerse = { ...verse };
    this.wordProgress = null;
    this.verseMatch = this.detectedVerse ? this.matchesExpected(this.detectedVerse) : null;
    this.notifyListeners();
  }

  public detectVerse(verse: SelectedVerse): void {
    this.detectedVerse = { ...verse };
    this.verseMatch = this.matchesExpected(verse);
    this.notifyListeners();
  }

  public updateWordProgress(progress: WordProgress): boolean {
    if (!this.expectedVerse || !this.matchesExpected(progress)) {
      return false;
    }

    this.wordProgress = { ...progress };
    this.notifyListeners();
    return true;
  }

  public getWordProgress(): WordProgress | null {
    return this.copyWordProgress(this.wordProgress);
  }

  public subscribe(listener: ReadingStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private copyVerse(verse: SelectedVerse | null): SelectedVerse | null {
    return verse ? { ...verse } : null;
  }

  private copyWordProgress(progress: WordProgress | null): WordProgress | null {
    return progress ? { ...progress } : null;
  }

  private matchesExpected(verse: Pick<SelectedVerse, "surah" | "ayah">): boolean | null {
    if (!this.expectedVerse) {
      return null;
    }

    return verse.surah === this.expectedVerse.surah && verse.ayah === this.expectedVerse.ayah;
  }
}
