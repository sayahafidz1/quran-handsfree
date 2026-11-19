/**
 * Pure state for "which screen is shown". No browser imports, so it can be unit-tested with plain Node.
 *
 * Three tabs (Beranda, Cari, Info) and one full-screen reading screen ("baca") that has no tab bar.
 * Leaving the reading screen goes back to the tab it was opened from (default Beranda).
 */
export type TabView = "beranda" | "cari" | "info";
export type AppView = TabView | "baca";

export interface ViewState {
  current(): AppView;
  /** Switch to a tab. Ignored while the reading screen is open (it has no tab bar). */
  showTab(tab: TabView): void;
  /** Open the full-screen reading screen. Remembers the tab to return to. */
  openReader(): void;
  /** Leave the reading screen. Returns the tab that is shown now (or the current tab when not reading). */
  closeReader(): TabView;
  isReading(): boolean;
  subscribe(listener: (view: AppView) => void): () => void;
}

export function createViewState(initialTab: TabView = "beranda"): ViewState {
  let tab: TabView = initialTab;
  let reading = false;
  const listeners = new Set<(view: AppView) => void>();

  const current = (): AppView => (reading ? "baca" : tab);
  const notify = (): void => {
    const view = current();
    listeners.forEach((listener) => listener(view));
  };

  return {
    current,
    showTab(next) {
      if (reading || next === tab) return;
      tab = next;
      notify();
    },
    openReader() {
      if (reading) return;
      reading = true;
      notify();
    },
    closeReader() {
      if (!reading) return tab;
      reading = false;
      notify();
      return tab;
    },
    isReading: () => reading,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
