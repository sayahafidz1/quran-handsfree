import { MicrophoneCapture } from "../audio/MicrophoneCapture.ts";
import { TilawaAdapter } from "../recognition/tilawa/TilawaAdapter.ts";
import type { RecognitionEvent } from "../recognition/types.ts";
import { ReadingSession } from "./reading/ReadingSession.ts";
import { getSurahInfo } from "../quran/index.ts";
import {
  AnchorCoordinator,
  WebSpeechCommandRecognizer,
  parseNavigationCommand,
  type CommandRecognitionEvent,
  type SelectedVerse
} from "../command/index.ts";

export function initApp(): void {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
  }

  // Anchor Coordinator
  const anchorCoordinator = new AnchorCoordinator();
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

  // Subscribe to Anchor changes
  anchorCoordinator.subscribeToSelectedVerse((selectedVerse: SelectedVerse) => {
    const surahInfo = getSurahInfo(selectedVerse.surah);
    anchorPositionEl.textContent = `Surat ${surahInfo ? surahInfo.name : `Surat ${selectedVerse.surah}`} (${selectedVerse.surah}), Ayat ${selectedVerse.ayah}`;
    anchorBadgeEl.textContent = "LOCKED POSITION";
    anchorBadgeEl.className = "badge locked";
    anchorDetailEl.textContent = "Posisi awal dipilih melalui perintah pengguna. Hasil deteksi Tilawa tidak mengubah pilihan ini.";
  });

  // Handle Command Submission
  function executeCommand(text: string): void {
    if (!text || !text.trim()) return;

    commandFeedbackEl.className = "feedback-msg info";
    commandFeedbackEl.textContent = `Memproses perintah: "${text}"…`;

    const result = parseNavigationCommand(text);
    if (result.success) {
      anchorCoordinator.setAnchorFromCommand(result);
      readingSession.start({ surah: result.surah, ayah: result.ayah });
      commandFeedbackEl.className = "feedback-msg success";
      commandFeedbackEl.textContent = `✓ Berhasil dikunci ke Surat ${result.surahName} (${result.surah}) ayat ${result.ayah}.`;
    } else {
      commandFeedbackEl.className = "feedback-msg error";
      commandFeedbackEl.textContent = `✗ ${result.message}`;
    }
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
          if (event.result.success) {
            anchorCoordinator.setAnchorFromCommand(event.result);
            readingSession.start({ surah: event.result.surah, ayah: event.result.ayah });
            commandFeedbackEl.className = "feedback-msg success";
            commandFeedbackEl.textContent = `✓ Berhasil dikunci ke Surat ${event.result.surahName} (${event.result.surah}) ayat ${event.result.ayah}.`;
          } else {
            commandFeedbackEl.className = "feedback-msg error";
            commandFeedbackEl.textContent = `✗ ${event.result.message}`;
          }
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
  let ready = false;
  const microphone = new MicrophoneCapture();
  const recognition = new TilawaAdapter(handleRecognitionEvent);

  prepare.addEventListener("click", () => {
    prepare.disabled = true;
    status.textContent = "Menyiapkan pengenalan Tilawa…";
    recognition.initialize();
  });

  start.addEventListener("click", async () => {
    try {
      await microphone.start((samples) => recognition.feed(samples));
      readingSession.start(anchorCoordinator.getSelectedVerse() ?? undefined);
      recognition.reset();
      status.textContent = "Mendengarkan lantunan ayat…";
      start.disabled = true;
      stop.disabled = false;
    } catch (error) {
      status.textContent = "Mikrofon tidak dapat digunakan.";
      detail.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  stop.addEventListener("click", async () => {
    await microphone.stop();
    recognition.reset();
    readingSession.reset();
    status.textContent = "Pengenalan dihentikan.";
    start.disabled = !ready;
    stop.disabled = true;
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

      // Also set anchor from recitation discovery
      try {
        anchorCoordinator.setAnchorFromRecitation(event.surah, event.ayah);
      } catch (err) {
        console.warn("Failed to anchor recitation match:", err);
      }
    }
    if (event.type === "word_progress") {
      const accepted = readingSession.handleEvent(event);
      if (accepted) {
        detail.textContent = `Kemajuan ayat ${event.surah}:${event.ayah} — kata ${event.word_index}/${event.total_words}`;
      }
    }
  }

  window.addEventListener("beforeunload", () => {
    recognition.dispose();
    voiceRecognizer.dispose();
  });
}
