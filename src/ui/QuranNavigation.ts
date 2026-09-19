import type { AyahReference, QuranContentProvider } from "../quran/content/index.ts";

export type QuranNavigationSelect = (reference: AyahReference) => void;

export class QuranNavigation {
  private readonly surahSelect: HTMLSelectElement;
  private readonly ayahSelect: HTMLSelectElement;
  private readonly juzSelect: HTMLSelectElement;
  private readonly searchInput: HTMLInputElement;
  private readonly feedback: HTMLElement;
  private readonly currentButton: HTMLButtonElement;
  private currentPosition: AyahReference | null = null;

  public constructor(
    root: HTMLElement,
    private readonly content: QuranContentProvider,
    private readonly onSelect: QuranNavigationSelect
  ) {
    this.searchInput = root.querySelector<HTMLInputElement>("#navigation-search")!;
    this.surahSelect = root.querySelector<HTMLSelectElement>("#navigation-surah")!;
    this.ayahSelect = root.querySelector<HTMLSelectElement>("#navigation-ayah")!;
    this.juzSelect = root.querySelector<HTMLSelectElement>("#navigation-juz")!;
    this.feedback = root.querySelector<HTMLElement>("#navigation-feedback")!;
    this.currentButton = root.querySelector<HTMLButtonElement>("#navigation-current")!;

    this.populateJuz();
    this.populateSurahs();
    this.updateAyahs();
    this.searchInput.addEventListener("input", () => this.filterSurahs());
    this.surahSelect.addEventListener("change", () => this.updateAyahs());
    root.querySelector<HTMLButtonElement>("#navigation-open")!.addEventListener("click", () => {
      this.selectCurrentSurahAyah();
    });
    root.querySelector<HTMLButtonElement>("#navigation-juz-open")!.addEventListener("click", () => {
      const juz = this.content.getJuz(Number(this.juzSelect.value));
      if (juz) this.select(juz.start);
    });
    this.currentButton.addEventListener("click", () => {
      this.returnToCurrentPosition();
    });
  }

  public setCurrentPosition(position: AyahReference | null): void {
    this.currentPosition = position ? { ...position } : null;
    this.currentButton.disabled = !position;
    if (position) this.currentButton.textContent = `Kembali ke ${position.surah}:${position.ayah}`;
  }

  private populateSurahs(): void {
    this.surahSelect.replaceChildren(...this.content.getSurahs().map((surah) => {
      const option = new Option(`${surah.number}. ${surah.name}`, String(surah.number));
      option.dataset.search = `${surah.number} ${surah.name} ${surah.arabicName}`.toLocaleLowerCase();
      return option;
    }));
  }

  private populateJuz(): void {
    this.juzSelect.replaceChildren(new Option("Pilih juz…", ""));
    for (let number = 1; number <= 30; number += 1) {
      this.juzSelect.append(new Option(`Juz ${number}`, String(number)));
    }
  }

  private filterSurahs(): void {
    const query = this.searchInput.value.trim().toLocaleLowerCase();
    for (const option of Array.from(this.surahSelect.options)) {
      option.hidden = Boolean(query) && !option.dataset.search?.includes(query);
    }
    const firstVisible = Array.from(this.surahSelect.options).find((option) => !option.hidden);
    if (firstVisible) this.surahSelect.value = firstVisible.value;
    this.updateAyahs();
  }

  private updateAyahs(): void {
    const surah = this.content.getSurah(Number(this.surahSelect.value));
    this.ayahSelect.replaceChildren(...(surah?.ayahs ?? []).map((ayah) =>
      new Option(`Ayat ${ayah.ayah}`, String(ayah.ayah))
    ));
  }

  private selectCurrentSurahAyah(): void {
    this.select({
      surah: Number(this.surahSelect.value),
      ayah: Number(this.ayahSelect.value)
    });
  }

  private returnToCurrentPosition(): void {
    if (!this.currentPosition) return;
    this.searchInput.value = "";
    this.surahSelect.value = String(this.currentPosition.surah);
    this.updateAyahs();
    this.ayahSelect.value = String(this.currentPosition.ayah);
    this.juzSelect.value = "";
    this.feedback.textContent = `Posisi saat ini: ${this.currentPosition.surah}:${this.currentPosition.ayah}`;
    this.feedback.className = "feedback-msg info";
  }

  private select(reference: AyahReference): void {
    if (!this.content.getAyah(reference)) {
      this.feedback.textContent = "Referensi ayat tidak tersedia.";
      this.feedback.className = "feedback-msg error";
      return;
    }
    this.searchInput.value = "";
    this.surahSelect.value = String(reference.surah);
    this.updateAyahs();
    this.ayahSelect.value = String(reference.ayah);
    this.juzSelect.value = "";
    this.feedback.textContent = `Target dipilih: ${reference.surah}:${reference.ayah}`;
    this.feedback.className = "feedback-msg success";
    this.onSelect(reference);
  }
}
