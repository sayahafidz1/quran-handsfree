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

/** Finds the App plugin on `window.Capacitor` (injected by the APK); null in a normal browser. */
export function findCapacitorApp(globalObject: unknown): CapacitorAppLike | null {
  const plugins = (globalObject as { Capacitor?: { Plugins?: { App?: Partial<CapacitorAppLike> } } } | null)
    ?.Capacitor?.Plugins;
  const app = plugins?.App;
  if (app && typeof app.addListener === "function" && typeof app.exitApp === "function") {
    return app as CapacitorAppLike;
  }
  return null;
}
