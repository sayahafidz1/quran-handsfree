import { MicrophoneCapture } from "../audio/MicrophoneCapture.ts";
import { InactivityTimer } from "./reading/InactivityTimer.ts";
import { createListenGate } from "./listenGate.ts";
import { createWakeLockController, type WakeLockSentinelLike } from "./wakeLock.ts";
import { createRecognitionAdapter } from "../recognition/createAdapter.ts";
import type { RecognitionEvent } from "../recognition/types.ts";
import { ReadingSession, type ReadingSessionSnapshot } from "./reading/ReadingSession.ts";
import { getSurahInfo } from "../quran/index.ts";
import {
  WebSpeechCommandRecognizer,
  parseReaderCommand,
  type CommandRecognitionEvent
} from "../command/index.ts";
import type { ParseCommandResult } from "../command/types.ts";
import { loadOfflineQuranContent } from "../quran/content/index.ts";
import { QuranReader } from "../ui/QuranReader.ts";
import { QuranNavigation } from "../ui/QuranNavigation.ts";
import { BookmarksPanel } from "../ui/BookmarksPanel.ts";
import { createBookmarkStore, type BookmarkStorage } from "./bookmarks.ts";
import { getReadingStatus } from "../ui/readingStatus.ts";
import { recognitionDebugEnabled } from "../recognition/debug.ts";

/** Mengakses localStorage bisa melempar error (mode privat/data diblokir); hasilnya null bila gagal. */
function safeLocalStorage(): BookmarkStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function initApp(): void {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
  }

  const readingSession = new ReadingSession();

  // Anchor UI Elements
  const anchorPositionEl = document.querySelector<HTMLParagraphElement>("#anchor-position")!;
  const anchorBadgeEl = document.querySelector<HTMLSpanElement>("#anchor-badge")!;
  const anchorDetailEl = document.querySelector<HTMLParagraphElement>("#anchor-detail")!;

  // Voice Command UI Elements
  const commandInput = document.querySelector<HTMLInputElement>("#command-input")!;
  const commandSubmitBtn = document.querySelector<HTMLButtonElement>("#command-submit")!;
  const commandVoiceBtn = document.querySelector<HTMLButtonElement>("#command-voice")!;
  const commandFeedbackEl = document.querySelector<HTMLParagraphElement>("#command-feedback")!;
  const exampleChips = document.querySelectorAll<HTMLButtonElement>(".chip");

  // Recitation UI Elements
  const status = document.querySelector<HTMLParagraphElement>("#status")!;
  const detail = document.querySelector<HTMLParagraphElement>("#detail")!;
  const verse = document.querySelector<HTMLParagraphElement>("#verse")!;
  const confidence = document.querySelector<HTMLParagraphElement>("#confidence")!;
  const loadingBar = document.querySelector<HTMLElement>("#loading-bar")!;
  const loadingDialog = document.querySelector<HTMLDialogElement>("#loading-dialog")!;
  const loadingDialogText = document.querySelector<HTMLParagraphElement>("#loading-dialog-text")!;
  const loadingDialogClose = document.querySelector<HTMLButtonElement>("#loading-dialog-close")!;
  const prepare = document.querySelector<HTMLButtonElement>("#prepare")!;
  const start = document.querySelector<HTMLButtonElement>("#start")!;
  const stop = document.querySelector<HTMLButtonElement>("#stop")!;
  const readerElement = document.querySelector<HTMLElement>("#quran-reader")!;
  const readerStatusElement = document.querySelector<HTMLElement>("#reader-status")!;
  const readerTitleElement = document.querySelector<HTMLElement>("#reader-title")!;
  const readerStateElement = document.querySelector<HTMLElement>("#reader-state")!;
  const navigationRoot = document.querySelector<HTMLElement>("#quran-navigation")!;
  const bookmarksRoot = document.querySelector<HTMLElement>("#bookmarks")!;

  let reader: QuranReader | null = null;
  void loadOfflineQuranContent().then((content) => {
    reader = new QuranReader(
      readerElement,
      readerStatusElement,
      readerTitleElement,
      readerStateElement,
      content
    );
    readingSession.subscribe((snapshot) => reader?.render(snapshot));
    const navigation = new QuranNavigation(navigationRoot, content, (reference) => {
      readingSession.start(reference);
      void requestListening();
    }, () => {
      void requestListening();
    });
    const bookmarks = new BookmarksPanel(
      bookmarksRoot,
      createBookmarkStore(safeLocalStorage()),
      content,
      () => {
        const snapshot = readingSession.getState();
        return snapshot.currentVerse ?? snapshot.expectedVerse;
      },
      (reference) => {
        readingSession.start(reference);
        void requestListening();
      }
    );
    readingSession.subscribe((snapshot) => {
      const position = snapshot.currentVerse ?? snapshot.expectedVerse;
      navigation.setCurrentPosition(position);
      bookmarks.setHasPosition(position !== null);
      // "Terakhir dibaca" hanya dari ayat yang benar-benar terdeteksi, bukan sekadar dibuka manual.
      if (snapshot.currentVerse) bookmarks.noteReading(snapshot.currentVerse);
    });
  }).catch((error: unknown) => {
    readerStatusElement.textContent = "Teks Quran tidak dapat dimuat.";
    readerElement.replaceChildren();
    console.error("Unable to initialize Quran reader", error);
  });

  let lastLoggedReadingState: ReadingSessionSnapshot["state"] | null = null;
  readingSession.subscribe((snapshot: ReadingSessionSnapshot) => {
    if (recognitionDebugEnabled && snapshot.state !== lastLoggedReadingState) {
      console.debug("[READING_SESSION]", {
        state: snapshot.state,
        currentVerse: snapshot.currentVerse,
        expectedVerse: snapshot.expectedVerse,
        expectedNextVerse: snapshot.expectedNextVerse,
        detectedVerse: snapshot.detectedVerse,
        wordProgress: snapshot.wordProgress
      });
    }
    lastLoggedReadingState = snapshot.state;

    const readingStatus = getReadingStatus(snapshot);
    const position = snapshot.currentVerse ?? snapshot.expectedVerse;
    if (!position) {
      anchorPositionEl.textContent = "Belum ada posisi bacaan.";
      anchorBadgeEl.textContent = readingStatus.label;
      anchorBadgeEl.className = "badge";
      anchorBadgeEl.dataset.state = snapshot.state;
      anchorDetailEl.textContent = readingStatus.message;
      return;
    }

    const surahInfo = getSurahInfo(position.surah);
    anchorPositionEl.textContent = `Surat ${surahInfo ? surahInfo.name : `Surat ${position.surah}`} (${position.surah}), Ayat ${position.ayah}`;
    anchorBadgeEl.textContent = readingStatus.label;
    anchorBadgeEl.className = snapshot.state === "mismatch" ? "badge" : "badge locked";
    anchorBadgeEl.dataset.state = snapshot.state;
    anchorDetailEl.textContent = snapshot.state === "mismatch"
      ? readingStatus.message
      : `${readingStatus.message} ${snapshot.currentVerse
        ? "Posisi bacaan dikelola oleh ReadingSession."
        : "Posisi awal menunggu verifikasi Tilawa."}`;
  });

  // Handle Command Submission
  let listening = false;
  let ready = false;
  // Opening a verse (or a command) should switch the microphone on by itself, even while the model still loads.
  const listenGate = createListenGate();
  // Keeps the phone screen on while listening, so the automatic screen lock does not stop the microphone.
  const wakeLock = createWakeLockController({
    request: "wakeLock" in navigator
      ? (type) => navigator.wakeLock.request(type) as Promise<WakeLockSentinelLike>
      : undefined,
    isVisible: () => document.visibilityState === "visible"
  });
  document.addEventListener("visibilitychange", () => void wakeLock.onVisible());
  const microphone = new MicrophoneCapture();
  const recognition = createRecognitionAdapter(handleRecognitionEvent);
  // 10 s with no recognition event at all (real silence) means "a new search is
  // allowed" (rest between ruku'/sujud/rak'ahs). Reading the wrong verse still
  // produces events, so a mismatch is NOT a pause and never loosens the rules.
  // One-shot until the next event.
  const PAUSE_MS = 10_000;
  const pauseTimer = new InactivityTimer(PAUSE_MS, () => {
    if (listening) readingSession.handlePause();
  });

  async function startListening(): Promise<void> {
    if (listening || !ready) return;
    await microphone.start((samples) => recognition.feed(samples));
    readingSession.resumeListening();
    recognition.reset();
    listening = true;
    listenGate.setListening(true);
    void wakeLock.enable();
    pauseTimer.touch();
    status.textContent = "Mendengarkan lantunan ayat…";
    start.disabled = true;
    stop.disabled = false;
  }

  // The session decides when discovery must restart (end of a surah, basmalah
  // before the next one); only the app talks to the recognition engine.
  readingSession.onDiscoveryRestart(() => {
    if (listening) recognition.reset();
  });

  // Popup that blocks the page while the model loads. It closes when the model is ready or loading failed.
  // Safety valve: if neither happens within LOADING_ESCAPE_MS (stalled download), a "Tutup" button appears.
  const LOADING_ESCAPE_MS = 60_000;
  let loadingEscapeTimer: number | undefined;
  let loadingDialogWanted = false;

  function openLoadingDialog(): void {
    loadingDialogWanted = true;
    loadingDialogClose.hidden = true;
    loadingDialogText.textContent = "Mohon tunggu, model pengenalan sedang dimuat.";
    if (!loadingDialog.open) loadingDialog.showModal();
    window.clearTimeout(loadingEscapeTimer);
    loadingEscapeTimer = window.setTimeout(() => {
      loadingDialogClose.hidden = false;
    }, LOADING_ESCAPE_MS);
  }

  function closeLoadingDialog(): void {
    loadingDialogWanted = false;
    window.clearTimeout(loadingEscapeTimer);
    if (loadingDialog.open) loadingDialog.close();
  }

  // Esc must not dismiss the popup; if a browser closes it anyway (for example a second Esc), reopen it while loading.
  loadingDialog.addEventListener("cancel", (event) => event.preventDefault());
  loadingDialog.addEventListener("close", () => {
    if (loadingDialogWanted) loadingDialog.showModal();
  });
  loadingDialogClose.addEventListener("click", closeLoadingDialog);

  /** Starts loading the recognition model (once). Shows the loading popup until it is ready or fails. */
  function beginPreparing(): void {
    if (!listenGate.shouldPrepare()) return;
    listenGate.setPreparing(true);
    prepare.disabled = true;
    prepare.textContent = "Siapkan pengenalan";
    openLoadingDialog();
    loadingBar.hidden = false;
    status.textContent = "Menyiapkan pengenalan Tilawa…";
    detail.textContent = "";
    recognition.initialize();
  }

  async function tryStartListening(): Promise<void> {
    try {
      await startListening();
    } catch (error) {
      status.textContent = "Mikrofon tidak dapat digunakan.";
      detail.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  /** Turn the microphone on now if the model is ready, otherwise as soon as it is (loading it first if needed). */
  async function requestListening(): Promise<void> {
    const action = listenGate.request();
    if (action === "prepare") beginPreparing();
    if (action === "start") await tryStartListening();
  }

  async function stopListening(): Promise<void> {
    if (!listening) return;
    await microphone.stop();
    pauseTimer.stop();
    recognition.reset();
    readingSession.stopListening();
    listening = false;
    listenGate.setListening(false);
    void wakeLock.disable();
    status.textContent = "Pengenalan dihentikan.";
    start.disabled = !ready;
    stop.disabled = true;
  }

  async function applyCommand(result: ParseCommandResult): Promise<void> {
    if (!result.success) {
      commandFeedbackEl.className = "feedback-msg error";
      commandFeedbackEl.textContent = `✗ ${result.message}`;
      return;
    }
    if (result.command === "open") {
      readingSession.start({ surah: result.surah, ayah: result.ayah });
      void requestListening();
      commandFeedbackEl.className = "feedback-msg success";
      commandFeedbackEl.textContent = `✓ Berhasil dikunci ke Surat ${result.surahName} (${result.surah}) ayat ${result.ayah}.`;
      return;
    }
    if (result.command === "start" || result.command === "resume") await requestListening();
    if (result.command === "stop") await stopListening();
    if (result.command === "current") readingSession.returnToActivePosition();
    if (result.command === "repeat") readingSession.repeatActiveVerse();
    if (result.command === "next") readingSession.moveToNextVerse();
    if (result.command === "previous") readingSession.moveToPreviousVerse();
    commandFeedbackEl.className = "feedback-msg success";
    commandFeedbackEl.textContent = `✓ Perintah "${result.rawText}" dijalankan.`;
  }

  function executeCommand(text: string): void {
    if (!text || !text.trim()) return;

    commandFeedbackEl.className = "feedback-msg info";
    commandFeedbackEl.textContent = `Memproses perintah: "${text}"…`;

    void applyCommand(parseReaderCommand(text));
  }

  commandSubmitBtn.addEventListener("click", () => {
    executeCommand(commandInput.value);
  });

  commandInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      executeCommand(commandInput.value);
    }
  });

  // Example chips click
  exampleChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const cmd = chip.getAttribute("data-cmd");
      if (cmd) {
        commandInput.value = cmd;
        executeCommand(cmd);
      }
    });
  });

  // Voice Recognizer for commands
  const voiceRecognizer = new WebSpeechCommandRecognizer();
  let isVoiceListening = false;

  commandVoiceBtn.addEventListener("click", async () => {
    if (isVoiceListening) {
      await voiceRecognizer.stop();
      isVoiceListening = false;
      commandVoiceBtn.textContent = "🎤 Bicara";
      commandVoiceBtn.classList.remove("listening");
      return;
    }

    if (!voiceRecognizer.isSupported()) {
      commandFeedbackEl.className = "feedback-msg info";
      commandFeedbackEl.textContent = "Web Speech API tidak tersedia di browser ini. Anda dapat mengetikkan perintah di atas.";
      return;
    }

    try {
      isVoiceListening = true;
      commandVoiceBtn.textContent = "⏹ Berhenti";
      commandVoiceBtn.classList.add("listening");

      await voiceRecognizer.start((event: CommandRecognitionEvent) => {
        if (event.type === "status") {
          commandFeedbackEl.className = "feedback-msg info";
          commandFeedbackEl.textContent = event.message;
        } else if (event.type === "transcript") {
          commandInput.value = event.transcript;
          commandFeedbackEl.className = "feedback-msg info";
          commandFeedbackEl.textContent = `Mendengar: "${event.transcript}"…`;
        } else if (event.type === "command_result") {
          if (recognitionDebugEnabled) {
            console.debug("[VOICE_COMMAND]", { event: "command_result_received", result: event.result });
          }
          void applyCommand(event.result);
          isVoiceListening = false;
          commandVoiceBtn.textContent = "🎤 Bicara";
          commandVoiceBtn.classList.remove("listening");
        } else if (event.type === "error") {
          commandFeedbackEl.className = "feedback-msg error";
          commandFeedbackEl.textContent = event.message;
          isVoiceListening = false;
          commandVoiceBtn.textContent = "🎤 Bicara";
          commandVoiceBtn.classList.remove("listening");
        }
      });
    } catch (err) {
      isVoiceListening = false;
      commandVoiceBtn.textContent = "🎤 Bicara";
      commandVoiceBtn.classList.remove("listening");
      commandFeedbackEl.className = "feedback-msg error";
      commandFeedbackEl.textContent = err instanceof Error ? err.message : String(err);
    }
  });

  // Recitation Engine (Tilawa)
  // The button is only needed to try again after a failure; loading starts by itself (see the end of initApp).
  prepare.addEventListener("click", () => {
    beginPreparing();
  });

  start.addEventListener("click", async () => {
    try {
      if (!readingSession.getState().currentVerse && !readingSession.getState().expectedVerse) {
        readingSession.start();
      }
      await startListening();
    } catch (error) {
      status.textContent = "Mikrofon tidak dapat digunakan.";
      detail.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  stop.addEventListener("click", async () => {
    await stopListening();
  });

  function handleRecognitionEvent(event: RecognitionEvent): void {
    if (event.type === "loading_status") {
      status.textContent = event.message;
      loadingDialogText.textContent = event.message;
    }
    if (event.type === "ready") {
      ready = true;
      loadingBar.hidden = true;
      closeLoadingDialog();
      status.textContent = "Siap mendengarkan.";
      detail.textContent = "Model Tilawa berjalan di perangkat ini.";
      start.disabled = false;
      if (listenGate.onReady() === "start") void tryStartListening();
    }
    if (event.type === "error") {
      listenGate.onError();
      loadingBar.hidden = true;
      closeLoadingDialog();
      status.textContent = "Pengenalan belum siap.";
      detail.textContent = event.message;
      prepare.textContent = "Coba lagi";
      prepare.disabled = false;
    }
    if (event.type === "verse_match") {
      readingSession.handleEvent(event);
      if (listening) pauseTimer.touch();
      verse.textContent = `Surah ${event.surah}, ayat ${event.ayah}: ${event.verse_text}`;
      confidence.textContent = `Keyakinan: ${Math.round(event.confidence * 100)}%`;
    }
    if (event.type === "word_progress") {
      const accepted = readingSession.handleEvent(event);
      if (listening) pauseTimer.touch();
      if (accepted) {
        detail.textContent = `Kemajuan ayat ${event.surah}:${event.ayah} — kata ${event.word_index + 1}/${event.total_words} (cocok ${event.matched_indices.length})`;
      }
    }
  }

  // Load the model as soon as the page opens; the status line and the loading bar show the progress.
  beginPreparing();

  window.addEventListener("beforeunload", () => {
    reader?.dispose();
    recognition.dispose();
    voiceRecognizer.dispose();
  });
}
