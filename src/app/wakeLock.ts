/**
 * Keeps the screen awake while the app is listening, so the phone does not lock itself and stop the microphone.
 * Browser pieces are injected, so this can be unit-tested with plain Node.
 *
 * A screen wake lock is released by the browser whenever the page is hidden; `onVisible()` asks for it again
 * if listening is still wanted. It only prevents the automatic screen timeout: locking the screen by hand or
 * switching to another app can still make the browser stop the microphone.
 */
export interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
}

export interface WakeLockEnv {
  /** `navigator.wakeLock.request`, or undefined when the browser has no Wake Lock API. */
  request?: (type: "screen") => Promise<WakeLockSentinelLike>;
  isVisible: () => boolean;
}

export interface WakeLockController {
  /** Listening started: keep the screen on (when supported). */
  enable(): Promise<void>;
  /** Listening stopped: let the screen sleep again. */
  disable(): Promise<void>;
  /** The page became visible again: ask for the lock again if still wanted. */
  onVisible(): Promise<void>;
  isActive(): boolean;
}

export function createWakeLockController(env: WakeLockEnv): WakeLockController {
  let sentinel: WakeLockSentinelLike | null = null;
  let wanted = false;
  let requesting = false;

  async function acquire(): Promise<void> {
    if (!env.request || sentinel || requesting || !env.isVisible()) return;
    requesting = true;
    try {
      const lock = await env.request("screen");
      if (!wanted) {
        // Listening was stopped while the browser was still granting the lock.
        await lock.release().catch(() => {});
        return;
      }
      sentinel = lock;
      lock.addEventListener("release", () => {
        if (sentinel === lock) sentinel = null;
      });
    } catch {
      // Unsupported, denied (for example low battery) or the page is not visible: listening works without it.
    } finally {
      requesting = false;
    }
  }

  return {
    async enable() {
      wanted = true;
      await acquire();
    },
    async disable() {
      wanted = false;
      const lock = sentinel;
      sentinel = null;
      if (lock) await lock.release().catch(() => {});
    },
    async onVisible() {
      if (wanted) await acquire();
    },
    isActive: () => sentinel !== null
  };
}
