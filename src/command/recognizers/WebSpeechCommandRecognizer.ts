import { parseNavigationCommand } from "../commandParser.ts";
import type { CommandRecognitionEvent, VoiceCommandRecognizer } from "../types.ts";

// Polyfill type declaration for Web Speech API
interface IWindowSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export class WebSpeechCommandRecognizer implements VoiceCommandRecognizer {
  private recognition: any = null;
  private onEventCallback: ((event: CommandRecognitionEvent) => void) | null = null;
  private isRunning = false;

  public isSupported(): boolean {
    const win = typeof window !== "undefined" ? (window as IWindowSpeech) : null;
    return Boolean(win && (win.SpeechRecognition || win.webkitSpeechRecognition));
  }

  public async initialize(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error("Web Speech API tidak didukung di browser ini.");
    }
  }

  public async start(onEvent: (event: CommandRecognitionEvent) => void): Promise<void> {
    this.onEventCallback = onEvent;

    if (!this.isSupported()) {
      onEvent({
        type: "error",
        message: "Browser ini belum mendukung Web Speech Recognition. Silakan gunakan input teks perintah suara."
      });
      return;
    }

    const win = window as IWindowSpeech;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass();

    this.recognition.lang = "id-ID";
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;

    this.recognition.onstart = () => {
      this.isRunning = true;
      this.notify({
        type: "status",
        message: "Mendengarkan perintah suara navigasi (contoh: 'Al-Baqarah ayat 255')…"
      });
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0].transcript;
        if (item.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      if (interimTranscript) {
        this.notify({
          type: "transcript",
          transcript: interimTranscript,
          isFinal: false
        });
      }

      if (finalTranscript) {
        this.notify({
          type: "transcript",
          transcript: finalTranscript,
          isFinal: true
        });

        const parseResult = parseNavigationCommand(finalTranscript);
        this.notify({
          type: "command_result",
          result: parseResult
        });
      }
    };

    this.recognition.onerror = (event: any) => {
      this.notify({
        type: "error",
        message: `Pengenalan suara gagal: ${event.error || "Unknown error"}`
      });
    };

    this.recognition.onend = () => {
      this.isRunning = false;
      this.notify({
        type: "status",
        message: "Pengenalan suara perintah berhenti."
      });
    };

    try {
      this.recognition.start();
    } catch (err) {
      this.notify({
        type: "error",
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }

  public async stop(): Promise<void> {
    if (this.recognition && this.isRunning) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isRunning = false;
  }

  public dispose(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.isRunning = false;
    this.onEventCallback = null;
  }

  private notify(event: CommandRecognitionEvent): void {
    if (this.onEventCallback) {
      this.onEventCallback(event);
    }
  }
}
