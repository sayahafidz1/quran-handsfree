/**
 * Ties the full-screen reading screen to the browser history, so the Android back button (and the browser back
 * button) leaves the reading screen instead of closing the app. Pure: the history object is injected.
 *
 * Opening the reading screen adds one history entry. Leaving by the Kembali button goes back one entry, so the
 * history stays consistent; the "popstate" that follows is what actually closes the screen.
 */
export interface HistoryLike {
  readonly state: unknown;
  pushState(state: unknown, unused: string): void;
  replaceState(state: unknown, unused: string): void;
  back(): void;
}

const READER_STATE = { view: "baca" };

export interface ReaderHistory {
  /** At startup: forget a reader entry left over from before a page reload. */
  init(): void;
  /** The reading screen opened. */
  enter(): void;
  /** Kembali pressed. "back" = history goes back (a popstate follows); "direct" = close the screen yourself. */
  leave(): "back" | "direct";
}

function isReaderEntry(state: unknown): boolean {
  return typeof state === "object" && state !== null && (state as { view?: unknown }).view === "baca";
}

export function createReaderHistory(history: HistoryLike): ReaderHistory {
  return {
    init() {
      if (isReaderEntry(history.state)) history.replaceState({ view: "beranda" }, "");
    },
    enter() {
      if (!isReaderEntry(history.state)) history.pushState(READER_STATE, "");
    },
    leave() {
      if (!isReaderEntry(history.state)) return "direct";
      history.back();
      return "back";
    }
  };
}
