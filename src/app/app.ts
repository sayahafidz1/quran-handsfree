import { MicrophoneCapture } from "../audio/MicrophoneCapture.ts";
import { InactivityTimer } from "./reading/InactivityTimer.ts";
import { createListenGate } from "./listenGate.ts";
import { createReadingLog, describeRecognitionEvent, describeSessionChange } from "./readingLog.ts";
import { getLastReadVerse } from "./focusVerse.ts";
import { createModelReadyFlag } from "./modelReadyFlag.ts";
import { ARABIC_LEVEL_NAMES, createArabicSize } from "./displaySettings.ts";
import { createReaderHistory } from "./readerHistory.ts";
import { decideBackAction, findCapacitorApp, hasCapacitor } from "./backAction.ts";
import { createViewState, type AppView, type TabView } from "./viewState.ts";
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
import { BookmarksPanel, formatReferenceLabel } from "../ui/BookmarksPanel.ts";
import { createBookmarkStore, toggleBookmark, type BookmarkStorage } from "./bookmarks.ts";
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
  const loadingScreen = document.querySelector<HTMLElement>("#loading-screen")!;
  const loadingDialogText = document.querySelector<HTMLParagraphElement>("#loading-dialog-text")!;
  const loadingNote = document.querySelector<HTMLParagraphElement>("#loading-note")!;
  const loadingError = document.querySelector<HTMLParagraphElement>("#loading-error")!;
  const loadingRetry = document.querySelector<HTMLButtonElement>("#loading-retry")!;
  const loadingDialogClose = document.querySelector<HTMLButtonElement>("#loading-dialog-close")!;
  const prepare = document.querySelector<HTMLButtonElement>("#prepare")!;
  const startReading = document.querySelector<HTMLButtonElement>("#start-reading")!;
  const readerBack = document.querySelector<HTMLButtonElement>("#reader-back")!;
  const arabicSmaller = document.querySelector<HTMLButtonElement>("#arabic-smaller")!;
  const arabicLarger = document.querySelector<HTMLButtonElement>("#arabic-larger")!;
  const arabicDots = document.querySelectorAll<HTMLElement>("#arabic-dots .size-dot");
  const arabicSizeLabel = document.querySelector<HTMLElement>("#arabic-size-label")!;
  const readerEmpty = document.querySelector<HTMLElement>("#reader-empty")!;
  const readerEmptyTitle = document.querySelector<HTMLElement>("#reader-empty-title")!;
  const readerEmptyText = document.querySelector<HTMLElement>("#reader-empty-text")!;
  const tabBar = document.querySelector<HTMLElement>("#tab-bar")!;
  const viewElements = document.querySelectorAll<HTMLElement>(".view");
  const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab");
  const readerElement = document.querySelector<HTMLElement>("#quran-reader")!;
  const readerStatusElement = document.querySelector<HTMLElement>("#reader-status")!;
  const readerTitleElement = document.querySelector<HTMLElement>("#reader-title")!;
  const readerStateElement = document.querySelector<HTMLElement>("#reader-state")!;
  const navigationRoot = document.querySelector<HTMLElement>("#quran-navigation")!;
  const bookmarksRoot = document.querySelector<HTMLElement>("#bookmarks")!;

  // Screens: four tabs and a full-screen reading screen (no tab bar).
  const views = createViewState();
  function renderViews(view: AppView): void {
    viewElements.forEach((element) => {
      element.hidden = element.dataset.view !== view;
    });
    tabBar.hidden = view === "baca";
    tabButtons.forEach((button) => {
      if (button.dataset.tab === view) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
  }
  views.subscribe(renderViews);
  // Android back button (and browser back) leaves the reading screen: one history entry per opened reader.
  const readerHistory = createReaderHistory(window.history);
  readerHistory.init();
  views.subscribe((view) => {
    if (view === "baca") readerHistory.enter();
  });
  window.addEventListener("popstate", () => {
    if (!views.isReading()) return;
    views.closeReader();
    void stopListening();
  });
  renderViews(views.current());
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => views.showTab(button.dataset.tab as TabView));
  });


  // Short message on the reading screen (bookmark saved/removed); clears itself.
  const readerToast = document.querySelector<HTMLElement>("#reader-toast")!;
  let readerToastTimer: number | undefined;
  function showReaderToast(message: string, kind: "success" | "error" | "info"): void {
    readerToast.textContent = message;
    readerToast.className = `feedback-msg reader-toast ${kind}`;
    window.clearTimeout(readerToastTimer);
    readerToastTimer = window.setTimeout(() => {
      readerToast.textContent = "";
    }, 2500);
  }

  let reader: QuranReader | null = null;
  void loadOfflineQuranContent().then((content) => {
    reader = new QuranReader(
      readerElement,
      readerStatusElement,
      readerTitleElement,
      readerStateElement,
      content
    );
    const bookmarkStore = createBookmarkStore(safeLocalStorage());
    readingSession.subscribe((snapshot) => {
      reader?.render(snapshot);
      // Before any verse is known the reading screen shows the big microphone instead of an empty page.
      readerEmpty.hidden = (snapshot.currentVerse ?? snapshot.expectedVerse) !== null;
    });
    const navigation = new QuranNavigation(navigationRoot, content, (reference) => {
      openPosition(reference);
    }, () => {
      void requestListening();
    });
    const bookmarks = new BookmarksPanel(
      bookmarksRoot,
      bookmarkStore,
      content,
      (reference) => {
        openPosition(reference);
      },
      () => reader?.refresh()
    );
    // Ikon bookmark di tiap ayat layar baca: simpan/hapus tanpa menghentikan bacaan.
    reader.setBookmarks({
      has: (reference) => bookmarkStore.has(reference),
      toggle: (reference) => {
        const result = toggleBookmark(bookmarkStore, reference);
        const label = formatReferenceLabel(reference);
        if (result === "added") showReaderToast(`Bookmark disimpan: ${label}`, "success");
        else if (result === "removed") showReaderToast(`Bookmark dihapus: ${label}`, "info");
        else showReaderToast("Bookmark tidak bisa disimpan (penyimpanan penuh atau tidak tersedia).", "error");
        bookmarks.refresh();
        reader?.refresh();
      }
    });
    readingSession.subscribe((snapshot) => {
      const position = snapshot.currentVerse ?? snapshot.expectedVerse;
      navigation.setCurrentPosition(position);
      // "Terakhir dibaca" hanya dari ayat yang benar-benar terdeteksi, bukan sekadar dibuka manual.
      // Setelah satu ayat dibaca penuh, yang diingat adalah ayat berikutnya (tempat melanjutkan).
      const lastRead = getLastReadVerse(snapshot);
      if (lastRead) bookmarks.noteReading(lastRead);
    });
  }).catch((error: unknown) => {
    readerStatusElement.textContent = "Teks Quran tidak dapat dimuat.";
    readerElement.replaceChildren();
    console.error("Unable to initialize Quran reader", error);
  });

  // Catatan bacaan (tab Info): untuk diagnosis di ponsel; hanya nomor surat/ayat/kata.
  const readingLog = createReadingLog();
  function logEvent(text: string | null): void {
    if (text) readingLog.add(performance.now(), text);
  }
  let previousLogged: ReadingSessionSnapshot | null = null;
  readingSession.subscribe((snapshot) => {
    logEvent(describeSessionChange(previousLogged, snapshot));
    previousLogged = snapshot;
  });
  const readingLogDetails = document.querySelector<HTMLDetailsElement>("#reading-log-details")!;
  const readingLogText = document.querySelector<HTMLElement>("#reading-log-text")!;
  const readingLogFeedback = document.querySelector<HTMLElement>("#reading-log-feedback")!;
  const readingLogCopy = document.querySelector<HTMLButtonElement>("#reading-log-copy")!;
  const buildLogText = (): string =>
    readingLog.toText(`Quran Hands-Free catatan bacaan ${new Date().toISOString()} | ${navigator.userAgent}`);
  readingLogDetails.addEventListener("toggle", () => {
    if (readingLogDetails.open) readingLogText.textContent = buildLogText();
  });
  readingLogCopy.addEventListener("click", async () => {
    const text = buildLogText();
    readingLogText.textContent = text;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      // Fallback for WebViews without the async clipboard API.
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      area.remove();
    }
    readingLogFeedback.textContent = copied
      ? `Disalin (${readingLog.size()} baris). Tempelkan ke pengembang.`
      : "Tidak bisa menyalin otomatis. Tekan lama teks di bawah, pilih semua, lalu salin.";
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

  /** What the big-microphone page says; "off" is only shown briefly before listening starts. */
  function setReaderMic(kind: "on" | "waiting" | "error", message?: string): void {
    if (kind === "on") {
      readerEmptyTitle.textContent = "Mikrofon menyala";
      readerEmptyText.textContent = "Mulailah membaca. Ayatnya akan dikenali otomatis.";
    } else if (kind === "waiting") {
      readerEmptyTitle.textContent = "Menyiapkan mikrofon…";
      readerEmptyText.textContent = "Mohon tunggu sebentar.";
    } else {
      readerEmptyTitle.textContent = "Mikrofon tidak dapat digunakan";
      readerEmptyText.textContent = message ?? "Izinkan akses mikrofon, lalu coba lagi.";
    }
  }

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
    setReaderMic("on");
  }

  // The session decides when discovery must restart (end of a surah, basmalah
  // before the next one); only the app talks to the recognition engine.
  readingSession.onDiscoveryRestart(() => {
    if (listening) recognition.reset();
  });

  // Full-screen page while the model loads. It goes away when the model is ready or loading failed.
  // Safety valve: if neither happens within LOADING_ESCAPE_MS (stalled download), a "Tutup" button appears.
  const LOADING_ESCAPE_MS = 60_000;
  let loadingEscapeTimer: number | undefined;

  const modelReadyFlag = createModelReadyFlag(safeLocalStorage());

  function showLoadingScreen(): void {
    loadingScreen.hidden = false;
    loadingScreen.dataset.state = "loading";
    loadingBar.hidden = false;
    // After the first successful start the model is already on this device: say so, and drop the "only once" note.
    const seenBefore = modelReadyFlag.wasReady();
    loadingNote.hidden = seenBefore;
    loadingError.hidden = true;
    loadingRetry.hidden = true;
    loadingDialogClose.hidden = true;
    loadingDialogText.textContent = seenBefore
      ? "Memuat model dari perangkat…"
      : "Mohon tunggu, model pengenalan sedang dimuat.";
    window.clearTimeout(loadingEscapeTimer);
    loadingEscapeTimer = window.setTimeout(() => {
      loadingDialogClose.hidden = false;
    }, LOADING_ESCAPE_MS);
  }

  function hideLoadingScreen(): void {
    window.clearTimeout(loadingEscapeTimer);
    loadingScreen.hidden = true;
  }

  function showLoadingError(message: string): void {
    window.clearTimeout(loadingEscapeTimer);
    loadingScreen.hidden = false;
    loadingScreen.dataset.state = "error";
    loadingBar.hidden = true;
    loadingNote.hidden = true;
    loadingDialogClose.hidden = true;
    loadingDialogText.textContent = "Belum bisa disiapkan";
    loadingError.textContent = `${message} Pastikan internet menyala, lalu coba lagi. Jika terus gagal, kemungkinan memori perangkat kurang.`;
    loadingError.hidden = false;
    loadingRetry.hidden = false;
  }

  loadingDialogClose.addEventListener("click", hideLoadingScreen);
  loadingRetry.addEventListener("click", () => beginPreparing());

  /** Starts loading the recognition model (once). Shows the full-screen loading page until it is ready or fails. */
  function beginPreparing(): void {
    if (!listenGate.shouldPrepare()) return;
    listenGate.setPreparing(true);
    prepare.disabled = true;
    prepare.textContent = "Siapkan pengenalan";
    showLoadingScreen();
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
      setReaderMic("error", detail.textContent);
    }
  }

  /**
   * Opens a verse as the strict manual target (Buka ayat, bookmark, last read, command "open").
   * While already listening, the engine is reset once so words of the place the reader just left
   * (still in the decoder context) are not matched against the new target.
   */
  function openPosition(reference: { surah: number; ayah: number }): void {
    readingSession.start(reference);
    if (listening) recognition.reset();
    void requestListening();
  }

  /** Turn the microphone on now if the model is ready, otherwise as soon as it is (loading it first if needed). */
  async function requestListening(): Promise<void> {
    views.openReader();
    if (!listening) setReaderMic("waiting");
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
  }

  /** Kembali from the reading screen: stop listening, then show the tab it was opened from. */
  async function leaveReader(): Promise<void> {
    // While the reader has its history entry, going back closes it (the popstate handler does the stop).
    if (views.isReading() && readerHistory.leave() === "back") return;
    views.closeReader();
    await stopListening();
  }

  // Inside the APK the Android back button is handled here (the History API entry is not enough there).
  // Without the Capacitor App plugin (normal browser) nothing is registered and the History API does the work.
  const capacitorApp = findCapacitorApp(window);
  const backStatus = document.querySelector<HTMLElement>("#back-status");
  if (backStatus) {
    backStatus.textContent = capacitorApp
      ? "Tombol kembali Android: ditangani aplikasi (plugin aktif)."
      : hasCapacitor(window)
        ? "Tombol kembali Android: APK terdeteksi tetapi plugin tidak ditemukan."
        : "Tombol kembali: memakai riwayat browser.";
  }
  capacitorApp?.addListener("backButton", () => {
    const action = decideBackAction(views.current());
    if (action === "leave-reader") void leaveReader();
    else if (action === "show-beranda") views.showTab("beranda");
    else capacitorApp.exitApp();
  });

  async function applyCommand(result: ParseCommandResult): Promise<void> {
    if (!result.success) {
      commandFeedbackEl.className = "feedback-msg error";
      commandFeedbackEl.textContent = `✗ ${result.message}`;
      return;
    }
    if (result.command === "open") {
      openPosition({ surah: result.surah, ayah: result.ayah });
      commandFeedbackEl.className = "feedback-msg success";
      commandFeedbackEl.textContent = `✓ Berhasil dikunci ke Surat ${result.surahName} (${result.surah}) ayat ${result.ayah}.`;
      return;
    }
    if (result.command === "start" || result.command === "resume") await requestListening();
    if (result.command === "stop") await leaveReader();
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

  // "Mulai membaca": listen without a target (discovery), the verse is recognised on its own.
  startReading.addEventListener("click", () => {
    readingSession.reset();
    readingSession.start();
    void requestListening();
  });

  readerBack.addEventListener("click", () => {
    void leaveReader();
  });

  // Ukuran huruf Arab (tab Pengaturan): satu variabel CSS (--arabic-scale) dipakai .arabic-text, termasuk ayat contoh di tab itu; pilihan diingat di perangkat.
  const arabicSize = createArabicSize(safeLocalStorage());
  function applyArabicSize(): void {
    document.documentElement.style.setProperty("--arabic-scale", String(arabicSize.scale()));
    arabicSmaller.disabled = !arabicSize.canStep(-1);
    arabicLarger.disabled = !arabicSize.canStep(1);
    arabicDots.forEach((dot, index) => dot.classList.toggle("active", index === arabicSize.level()));
    arabicSizeLabel.textContent = `Ukuran huruf ${ARABIC_LEVEL_NAMES[arabicSize.level()]}`;
  }
  function stepArabicSize(delta: 1 | -1): void {
    arabicSize.step(delta);
    applyArabicSize();
  }
  arabicSmaller.addEventListener("click", () => stepArabicSize(-1));
  arabicLarger.addEventListener("click", () => stepArabicSize(1));
  applyArabicSize();

  function handleRecognitionEvent(event: RecognitionEvent): void {
    if (event.type === "loading_status") {
      status.textContent = event.message;
      loadingDialogText.textContent = event.message;
    }
    if (event.type === "ready") {
      ready = true;
      loadingBar.hidden = true;
      hideLoadingScreen();
      modelReadyFlag.markReady();
      status.textContent = "Siap mendengarkan.";
      detail.textContent = "Model Tilawa berjalan di perangkat ini.";
      if (listenGate.onReady() === "start") void tryStartListening();
    }
    if (event.type === "error") {
      listenGate.onError();
      loadingBar.hidden = true;
      showLoadingError(event.message);
      status.textContent = "Pengenalan belum siap.";
      detail.textContent = event.message;
      prepare.textContent = "Coba lagi";
      prepare.disabled = false;
    }
    if (event.type === "verse_match") {
      readingSession.handleEvent(event);
      logEvent(describeRecognitionEvent(event));
      if (listening) pauseTimer.touch();
      verse.textContent = `Surah ${event.surah}, ayat ${event.ayah}: ${event.verse_text}`;
      confidence.textContent = `Keyakinan: ${Math.round(event.confidence * 100)}%`;
    }
    if (event.type === "engine_note") logEvent(event.text);
    if (event.type === "word_omission") readingSession.handleEvent(event);
    if (event.type === "word_progress") {
      const accepted = readingSession.handleEvent(event);
      logEvent(describeRecognitionEvent(event, accepted));
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
