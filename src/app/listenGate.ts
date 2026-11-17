/**
 * Pure state for "turn the microphone on as soon as the recognition model is ready".
 * No browser imports, so it can be unit-tested with plain Node.
 *
 * Flow: a request to listen (open a verse, voice command, ...) either starts at once (model ready),
 * waits for the model that is still loading, or first asks the app to start loading it.
 */
export type ListenRequestAction = "start" | "wait" | "prepare" | "none";

export interface ListenGate {
  /** True when the app should begin loading the model (not ready and not already loading). */
  shouldPrepare(): boolean;
  setPreparing(value: boolean): void;
  setListening(value: boolean): void;
  /** Someone asked to listen. Tells the app what to do now. */
  request(): ListenRequestAction;
  /** The model finished loading. Returns "start" when a listen request was waiting. */
  onReady(): "start" | "none";
  /** Loading failed: nothing can be waited for any more. */
  onError(): void;
}

export function createListenGate(): ListenGate {
  let ready = false;
  let preparing = false;
  let listening = false;
  let pending = false;

  return {
    shouldPrepare: () => !ready && !preparing,
    setPreparing(value) {
      preparing = value;
    },
    setListening(value) {
      listening = value;
    },
    request() {
      if (listening) return "none";
      if (ready) return "start";
      pending = true;
      return preparing ? "wait" : "prepare";
    },
    onReady() {
      ready = true;
      preparing = false;
      if (!pending) return "none";
      pending = false;
      return listening ? "none" : "start";
    },
    onError() {
      // Also after an error that comes later (model already ready): "try again" must be able to reload it.
      ready = false;
      preparing = false;
      pending = false;
    }
  };
}
