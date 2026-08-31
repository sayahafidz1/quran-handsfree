import { getSurahInfo, validateSurahAndAyah } from "../../quran/index.ts";
import type { AnchorSource, NavigationAnchor, ParseCommandSuccess } from "../types.ts";

export type AnchorListener = (anchor: NavigationAnchor) => void;

export class AnchorCoordinator {
  private currentAnchor: NavigationAnchor | null = null;
  private listeners: Set<AnchorListener> = new Set();

  public getAnchor(): NavigationAnchor | null {
    return this.currentAnchor;
  }

  public setAnchorFromCommand(cmd: ParseCommandSuccess): NavigationAnchor {
    return this.setAnchor(cmd.surah, cmd.ayah, "voice_command");
  }

  public setAnchorFromRecitation(surah: number, ayah: number): NavigationAnchor {
    return this.setAnchor(surah, ayah, "recitation_discovery");
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

    this.notifyListeners(this.currentAnchor);
    return this.currentAnchor;
  }

  public clearAnchor(): void {
    this.currentAnchor = null;
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
}
