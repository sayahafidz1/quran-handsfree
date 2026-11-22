import type { AppView } from "./viewState.ts";

/**
 * What the Android back button does inside the APK (Capacitor). Pure, so it can be unit-tested.
 * Reading screen: leave it and stop listening. Another tab: go to Beranda. Beranda: exit the app.
 * (In a normal browser the History API handles the back button instead; see readerHistory.ts.)
 */
export type BackAction = "leave-reader" | "show-beranda" | "exit-app";

export function decideBackAction(view: AppView): BackAction {
  if (view === "baca") return "leave-reader";
  if (view === "beranda") return "exit-app";
  return "show-beranda";
}

/** The part of Capacitor's App plugin that is used. Present only inside the APK. */
export interface CapacitorAppLike {
  addListener(event: "backButton", handler: () => void): unknown;
  exitApp(): void;
}

type CapacitorGlobal = {
  Plugins?: { App?: Partial<CapacitorAppLike> };
  registerPlugin?: (name: string) => Partial<CapacitorAppLike>;
};

function isApp(value: Partial<CapacitorAppLike> | undefined): value is CapacitorAppLike {
  return !!value && typeof value.addListener === "function" && typeof value.exitApp === "function";
}

/** True inside the APK: Capacitor injects `window.Capacitor` there. */
export function hasCapacitor(globalObject: unknown): boolean {
  return !!(globalObject as { Capacitor?: unknown } | null)?.Capacitor;
}

/**
 * Finds the App plugin through `window.Capacitor` (injected by the APK); null in a normal browser.
 * Tries `Capacitor.Plugins.App` first, then `Capacitor.registerPlugin("App")`, which is what the plugin's own
 * JavaScript does (the native side must still have the plugin installed).
 */
export function findCapacitorApp(globalObject: unknown): CapacitorAppLike | null {
  const capacitor = (globalObject as { Capacitor?: CapacitorGlobal } | null)?.Capacitor;
  if (!capacitor) return null;
  if (isApp(capacitor.Plugins?.App)) return capacitor.Plugins.App;
  if (typeof capacitor.registerPlugin === "function") {
    try {
      const app = capacitor.registerPlugin("App");
      if (isApp(app)) return app;
    } catch {
      // plugin not available: fall back to the History API
    }
  }
  return null;
}
