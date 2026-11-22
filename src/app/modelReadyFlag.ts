/**
 * Remembers on this device that the recognition model has been prepared once. Only changes the wording of the
 * loading page ("first time" vs "loading from the device"); the model itself is cached by the SDK / APK.
 * Pure: storage is injected and may be missing or refuse to work.
 */
export interface FlagStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const MODEL_READY_KEY = "quran-handsfree:model-ready";

export interface ModelReadyFlag {
  wasReady(): boolean;
  markReady(): void;
}

export function createModelReadyFlag(storage: FlagStorage | null): ModelReadyFlag {
  return {
    wasReady() {
      try {
        return storage?.getItem(MODEL_READY_KEY) === "1";
      } catch {
        return false;
      }
    },
    markReady() {
      try {
        storage?.setItem(MODEL_READY_KEY, "1");
      } catch {
        // storage refused: the loading page just keeps the first-time wording
      }
    }
  };
}
