import type { RecognitionEvent } from "../recognition/types.ts";
import type { ReadingSessionSnapshot } from "./reading/ReadingSession.ts";

/**
 * A short in-memory log of what the recognition engine reported and what the reading session did with it,
 * for diagnosing problems on a phone (copied from the Info tab). Pure: timestamps are passed in.
 * Contains positions only (surah, ayah, word numbers); no audio and nothing about the person.
 */
export interface ReadingLogEntry {
  /** Milliseconds (any monotonic clock). Shown relative to the first entry. */
  t: number;
  text: string;
}

export interface ReadingLog {
  add(t: number, text: string): void;
  size(): number;
  /** Plain text, oldest first, with seconds relative to the first entry. */
  toText(header?: string): string;
  clear(): void;
}

export const READING_LOG_MAX = 150;

export function createReadingLog(max: number = READING_LOG_MAX): ReadingLog {
  let entries: ReadingLogEntry[] = [];
  return {
    add(t, text) {
      entries.push({ t, text });
      if (entries.length > max) entries = entries.slice(entries.length - max);
    },
    size: () => entries.length,
    toText(header) {
      const start = entries[0]?.t ?? 0;
      const lines = entries.map((entry) => `+${((entry.t - start) / 1000).toFixed(1)}s ${entry.text}`);
      return [...(header ? [header] : []), ...lines].join("\n");
    },
    clear() {
      entries = [];
    }
  };
}

/** One line for an engine event, or null for events that are not about the reading position. */
export function describeRecognitionEvent(event: RecognitionEvent, accepted?: boolean): string | null {
  if (event.type === "verse_match") {
    const basmala = event.basmala ? " basmalah" : "";
    return `verse_match ${event.surah}:${event.ayah} keyakinan=${Math.round(event.confidence * 100)}%${basmala}`;
  }
  if (event.type === "word_progress") {
    const verdict = accepted === undefined ? "" : accepted ? " diterima" : " diabaikan";
    return `word_progress ${event.surah}:${event.ayah} kursor=kata ${event.word_index + 1}/${event.total_words}`
      + ` cocok=[${event.matched_indices.join(",")}]${verdict}`;
  }
  return null;
}

function verseLabel(verse: { surah: number; ayah: number } | null): string {
  return verse ? `${verse.surah}:${verse.ayah}` : "-";
}

/** One line when the session state or its focus verse changed, otherwise null. */
export function describeSessionChange(
  previous: Pick<ReadingSessionSnapshot, "state" | "currentVerse" | "expectedNextVerse"> | null,
  next: Pick<ReadingSessionSnapshot, "state" | "currentVerse" | "expectedNextVerse">
): string | null {
  const sameState = previous?.state === next.state;
  const sameVerse = verseLabel(previous?.currentVerse ?? null) === verseLabel(next.currentVerse);
  if (sameState && sameVerse) return null;
  return `sesi ${previous?.state ?? "-"} -> ${next.state} aktif=${verseLabel(next.currentVerse)}`
    + ` berikutnya=${verseLabel(next.expectedNextVerse)}`;
}
