import { MicrophoneCapture } from "../audio/MicrophoneCapture.ts";
import { TilawaAdapter } from "../recognition/tilawa/TilawaAdapter.ts";
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
import { getReadingStatus } from "../ui/readingStatus.ts";

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
  const prepare = document.querySelector<HTMLButtonElement>("#prepare")!;
  const start = document.querySelector<HTMLButtonElement>("#start")!;
  const stop = document.querySelector<HTMLButtonElement>("#stop")!;
  const readerElement = document.querySelector<HTMLElement>("#quran-reader")!;
  const readerStatusElement = document.querySelector<HTMLElement>("#reader-status")!;
  const readerTitleElement = document.querySelector<HTMLElement>("#reader-title")!;
  const readerStateElement = document.querySelector<HTMLElement>("#reader-state")!;
  const navigationRoot = document.querySelector<HTMLElement>("#quran-navigation")!;

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
    });
    readingSession.subscribe((snapshot) => {
      navigation.setCurrentPosition(snapshot.currentVerse ?? snapshot.expectedVerse);
    });
  }).catch((error: unknown) => {
    readerStatusElement.textContent = "Teks Quran tidak dapat dimuat.";
    readerElement.replaceChildren();
    console.error("Unable to initialize Quran reader", error);
  });

  readingSession.subscribe((snapshot: ReadingSessionSnapshot) => {
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
  const microphone = new MicrophoneCapture();
  const recognition = new TilawaAdapter(handleRecognitionEvent);

  async function startListening(): Promise<void> {
    if (listening || !ready) return;
    await microphone.start((samples) => recognition.feed(samples));
    readingSession.resumeListening();
    recognition.reset();
    listening = true;
    status.textContent = "Mendengarkan lantunan ayat…";
    start.disabled = true;
    stop.disabled = false;
  }

  async function stopListening(): Promise<void> {
    if (!listening) return;
    await microphone.stop();
    recognition.reset();
    readingSession.stopListening();
    listening = false;
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
      commandFeedbackEl.className = "feedback-msg success";
      commandFeedbackEl.textContent = `✓ Berhasil dikunci ke Surat ${result.surahName} (${result.surah}) ayat ${result.ayah}.`;
      return;
    }
    if (result.command === "start" || result.command === "resume") await startListening();
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
  prepare.addEventListener("click", () => {
    prepare.disabled = true;
    status.textContent = "Menyiapkan pengenalan Tilawa…";
    recognition.initialize();
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
    if (event.type === "loading_status") status.textContent = event.message;
    if (event.type === "ready") {
      ready = true;
      status.textContent = "Siap mendengarkan.";
      detail.textContent = "Model Tilawa berjalan di perangkat ini.";
      start.disabled = false;
    }
    if (event.type === "error") {
      status.textContent = "Pengenalan belum siap.";
      detail.textContent = event.message;
      prepare.disabled = false;
    }
    if (event.type === "verse_match") {
      readingSession.handleEvent(event);
      verse.textContent = `Surah ${event.surah}, ayat ${event.ayah}: ${event.verse_text}`;
      confidence.textContent = `Keyakinan: ${Math.round(event.confidence * 100)}%`;
    }
    if (event.type === "word_progress") {
      const accepted = readingSession.handleEvent(event);
      if (accepted) {
        detail.textContent = `Kemajuan ayat ${event.surah}:${event.ayah} — kata ${event.word_index}/${event.total_words}`;
      }
    }
  }

  window.addEventListener("beforeunload", () => {
    reader?.dispose();
    recognition.dispose();
    voiceRecognizer.dispose();
  });
}
