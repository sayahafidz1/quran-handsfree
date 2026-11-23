import type { ReadingSessionSnapshot } from "./reading/ReadingSession.ts";
import type { SelectedVerse } from "../command/types.ts";

/**
 * Which ayah the reading screen puts in focus. While the session waits for the next ayah (the current one
 * was read in full) the focus moves on to that next ayah; otherwise it is the current ayah, or the target
 * that was opened but not yet detected. Pure.
 */
export function getFocusVerse(snapshot: ReadingSessionSnapshot): { verse: SelectedVerse | null; waiting: boolean } {
  if (snapshot.state === "expecting_next" && snapshot.expectedNextVerse) {
    return { verse: snapshot.expectedNextVerse, waiting: true };
  }
  return { verse: snapshot.currentVerse ?? snapshot.expectedVerse, waiting: false };
}

/**
 * The verse to remember as "terakhir dibaca". Only a detected reading counts (not a target merely opened by
 * hand). After a full ayah has been read, the ayah that follows it is the place to resume from.
 */
export function getLastReadVerse(snapshot: ReadingSessionSnapshot): SelectedVerse | null {
  if (snapshot.state === "expecting_next" && snapshot.expectedNextVerse) return snapshot.expectedNextVerse;
  return snapshot.currentVerse;
}
