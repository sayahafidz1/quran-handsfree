export interface TimerScheduler {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const browserScheduler: TimerScheduler = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>)
};

/**
 * Calls `onElapsed` once when `touch()` has not been called for `ms`.
 * After firing it stays idle until the next `touch()`.
 */
export class InactivityTimer {
  private handle: unknown = null;
  private readonly ms: number;
  private readonly onElapsed: () => void;
  private readonly scheduler: TimerScheduler;

  constructor(ms: number, onElapsed: () => void, scheduler: TimerScheduler = browserScheduler) {
    this.ms = ms;
    this.onElapsed = onElapsed;
    this.scheduler = scheduler;
  }

  /** Restart the countdown. */
  touch(): void {
    this.stop();
    this.handle = this.scheduler.setTimeout(() => {
      this.handle = null;
      this.onElapsed();
    }, this.ms);
  }

  stop(): void {
    if (this.handle !== null) this.scheduler.clearTimeout(this.handle);
    this.handle = null;
  }
}
