import { getSurahInfo, validateSurahAndAyah } from "../../quran/index.ts";
import { ReadingState } from "../../app/reading/ReadingState.ts";
import type { AnchorSource, NavigationAnchor, ParseCommandSuccess, SelectedVerse } from "../types.ts";
import type { WordProgress } from "../../app/reading/ReadingState.ts";

export type AnchorListener = (anchor: NavigationAnchor) => void;
export type SelectedVerseListener = (verse: SelectedVerse) => void;

export class AnchorCoordinator {
  private currentAnchor: NavigationAnchor | null = null;
  private readonly readingState = new ReadingState();
  private listeners: Set<AnchorListener> = new Set();
  private selectedVerseListeners: Set<SelectedVerseListener> = new Set();

  public getSelectedVerse(): SelectedVerse | null {
    return this.readingState.getSelectedVerse();
  }

  public getExpectedVerse(): SelectedVerse | null {
    return this.readingState.getExpectedVerse();
  }

  public getDetectedVerse(): SelectedVerse | null {
    return this.readingState.getDetectedVerse();
  }

  public getVerseMatch(): boolean | null {
    return this.readingState.getVerseMatch();
  }

  public getWordProgress(): WordProgress | null {
    return this.readingState.getWordProgress();
  }

  public getReadingState(): ReadingState {
    return this.readingState;
  }

  public getAnchor(): NavigationAnchor | null {
    return this.currentAnchor;
  }

  public setSelectedVerseFromCommand(cmd: ParseCommandSuccess): SelectedVerse {
    return this.setSelectedVerse(cmd.surah, cmd.ayah);
  }

  public setSelectedVerse(surah: number, ayah: number): SelectedVerse {
    const validation = validateSurahAndAyah(surah, ayah);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const verse = { surah, ayah };
    this.readingState.selectVerse(verse);
    this.notifySelectedVerseListeners(verse);
    return verse;
  }

  public setAnchorFromCommand(cmd: ParseCommandSuccess): NavigationAnchor {
    return this.setAnchor(cmd.surah, cmd.ayah, "voice_command");
  }

  public setAnchorFromRecitation(surah: number, ayah: number): NavigationAnchor | null {
    this.validateVerse(surah, ayah);
    this.readingState.detectVerse({ surah, ayah });

    if (this.readingState.getVerseMatch() === false) {
      return this.currentAnchor;
    }

    return this.setAnchor(surah, ayah, "recitation_discovery");
  }

  public setWordProgress(surah: number, ayah: number, wordIndex: number, totalWords: number): boolean {
    return this.readingState.updateWordProgress({ surah, ayah, wordIndex, totalWords });
  }

  public setAnchor(surah: number, ayah: number, source: AnchorSource = "manual"): NavigationAnchor {
    const validation = validateSurahAndAyah(surah, ayah);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const surahInfo = validation.surahInfo || getSurahInfo(surah);
    const surahName = surahInfo ? surahInfo.name : `Surat ${surah}`;

    this.currentAnchor = {
      surah,
      ayah,
      surahName,
      surahInfo,
      source,
      timestamp: Date.now()
    };

    if (source === "voice_command") {
      const verse = { surah, ayah };
      this.readingState.selectVerse(verse);
      this.notifySelectedVerseListeners(verse);
    }
    this.notifyListeners(this.currentAnchor);
    return this.currentAnchor;
  }

  public clearAnchor(): void {
    this.currentAnchor = null;
  }

  public subscribeToSelectedVerse(listener: SelectedVerseListener): () => void {
    this.selectedVerseListeners.add(listener);
    const selectedVerse = this.readingState.getSelectedVerse();
    if (selectedVerse) {
      listener(selectedVerse);
    }
    return () => {
      this.selectedVerseListeners.delete(listener);
    };
  }

  public subscribe(listener: AnchorListener): () => void {
    this.listeners.add(listener);
    if (this.currentAnchor) {
      listener(this.currentAnchor);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(anchor: NavigationAnchor): void {
    for (const listener of this.listeners) {
      try {
        listener(anchor);
      } catch (err) {
        console.error("Error in AnchorListener:", err);
      }
    }
  }

  private notifySelectedVerseListeners(verse: SelectedVerse): void {
    for (const listener of this.selectedVerseListeners) {
      try {
        listener(verse);
      } catch (err) {
        console.error("Error in SelectedVerseListener:", err);
      }
    }
  }

  private validateVerse(surah: number, ayah: number): void {
    const validation = validateSurahAndAyah(surah, ayah);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
  }
}
