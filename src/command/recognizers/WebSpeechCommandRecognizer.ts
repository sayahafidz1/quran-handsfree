import { parseReaderCommand } from "../commandParser.ts";
import { recognitionDebugEnabled } from "../../recognition/debug.ts";
import type { CommandRecognitionEvent, VoiceCommandRecognizer } from "../types.ts";

function debugVoiceCommand(event: string, details: Record<string, unknown> = {}): void {
  if (recognitionDebugEnabled) console.debug("[VOICE_COMMAND]", { event, ...details });
}

// Polyfill type declaration for Web Speech API
interface IWindowSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

/** Bila pengenal tidak mulai mendengar dalam waktu ini (mis. WebView yang tidak punya mesin suara), dianggap tidak responsif. */
export const START_TIMEOUT_MS = 6000;

/**
 * Tebakan ke-k untuk seluruh ucapan akhir: gabungan alternatif ke-k tiap hasil akhir (bila suatu hasil tidak
 * punya alternatif ke-k, dipakai tebakan pertamanya). Urutan pertama sama dengan transkrip akhir biasa.
 */
function finalCandidates(finals: any[], firstTranscript: string): string[] {
  const count = Math.max(1, ...finals.map((item) => Number(item.length) || 1));
  const candidates = [firstTranscript];
  for (let k = 1; k < count; k += 1) {
    const text = finals.map((item) => item[k]?.transcript ?? item[0].transcript).join("");
    if (!candidates.includes(text)) candidates.push(text);
  }
  return candidates;
}

export class WebSpeechCommandRecognizer implements VoiceCommandRecognizer {
  private recognition: any = null;
  private onEventCallback: ((event: CommandRecognitionEvent) => void) | null = null;
  private isRunning = false;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  // Per sesi dengar: agar tombol di UI selalu kembali (hasil, galat, atau berakhir tanpa suara) dan tidak ada galat ganda.
  private gotResult = false;
  private gotError = false;
  private stoppedByUser = false;

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
    this.gotResult = false;
    this.gotError = false;
    this.stoppedByUser = false;

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
      this.clearWatchdog();
      this.isRunning = true;
      debugVoiceCommand("listening", { language: this.recognition.lang });
      this.notify({
        type: "status",
        message: "Mendengarkan perintah suara navigasi (contoh: 'Al-Baqarah ayat 255')…"
      });
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      const finals: any[] = [];

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0].transcript;
        if (item.isFinal) {
          finalTranscript += text;
          finals.push(item);
        } else {
          interimTranscript += text;
        }
      }

      debugVoiceCommand("result", {
        resultIndex: event.resultIndex,
        finalTranscript,
        interimTranscript
      });

      if (interimTranscript) {
        this.notify({
          type: "transcript",
          transcript: interimTranscript,
          isFinal: false
        });
      }

      if (finalTranscript) {
        this.gotResult = true;

        // Pengenal memberi sampai maxAlternatives tebakan. Tebakan pertama menang bila bisa dibaca sebagai
        // perintah (perilaku lama); bila tidak, coba tebakan berikutnya berurutan.
        const candidates = finalCandidates(finals, finalTranscript);
        let chosen = candidates[0];
        let parseResult = parseReaderCommand(chosen);
        for (let k = 1; !parseResult.success && k < candidates.length; k += 1) {
          const next = parseReaderCommand(candidates[k]);
          if (next.success) {
            chosen = candidates[k];
            parseResult = next;
          }
        }
        this.notify({
          type: "transcript",
          transcript: chosen,
          isFinal: true
        });
        debugVoiceCommand("parsed", {
          alternatives: candidates,
          chosen,
          success: parseResult.success,
          command: parseResult.success ? parseResult.command : undefined,
          reason: parseResult.success ? undefined : parseResult.reason,
          surah: parseResult.success && parseResult.command === "open" ? parseResult.surah : undefined,
          ayah: parseResult.success && parseResult.command === "open" ? parseResult.ayah : undefined,
          message: parseResult.success ? undefined : parseResult.message
        });
        this.notify({
          type: "command_result",
          result: parseResult
        });
      }
    };

    this.recognition.onaudiostart = () => debugVoiceCommand("audio_started");
    this.recognition.onsoundstart = () => debugVoiceCommand("sound_detected");
    this.recognition.onspeechstart = () => debugVoiceCommand("speech_detected");
    this.recognition.onspeechend = () => debugVoiceCommand("speech_ended");
    this.recognition.onnomatch = () => debugVoiceCommand("no_match");

    this.recognition.onerror = (event: any) => {
      debugVoiceCommand("error", { code: event.error, message: event.message });
      this.clearWatchdog();
      this.gotError = true;
      this.notify({
        type: "error",
        message: `Pengenalan suara gagal: ${event.error || "Unknown error"}`
      });
    };

    this.recognition.onend = () => {
      this.clearWatchdog();
      this.isRunning = false;
      debugVoiceCommand("ended");
      if (!this.gotResult && !this.gotError && !this.stoppedByUser) {
        // Berakhir tanpa hasil dan tanpa galat: beri tahu agar tombol Bicara kembali dan pengguna tahu harus apa.
        this.gotError = true;
        this.notify({ type: "error", message: "Tidak ada perintah yang terdengar. Coba lagi atau ketik perintahnya di kotak." });
        return;
      }
      this.notify({
        type: "status",
        message: "Pengenalan suara perintah berhenti."
      });
    };

    try {
      debugVoiceCommand("start_requested", { supported: true, language: this.recognition.lang });
      this.recognition.start();
      this.watchdog = setTimeout(() => this.onStartTimeout(), START_TIMEOUT_MS);
    } catch (err) {
      debugVoiceCommand("start_failed", { message: err instanceof Error ? err.message : String(err) });
      this.notify({
        type: "error",
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }

  public async stop(): Promise<void> {
    this.stoppedByUser = true;
    this.clearWatchdog();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isRunning = false;
  }

  public dispose(): void {
    this.stoppedByUser = true;
    this.clearWatchdog();
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

  private clearWatchdog(): void {
    if (this.watchdog !== null) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private onStartTimeout(): void {
    this.watchdog = null;
    if (this.isRunning || this.gotError || this.stoppedByUser) return;
    debugVoiceCommand("start_timeout", { afterMs: START_TIMEOUT_MS });
    this.gotError = true;
    try {
      this.recognition?.abort();
    } catch {
      // ignore
    }
    this.notify({ type: "error", message: "Pengenalan suara tidak merespons di perangkat ini. Ketik perintahnya di kotak." });
  }

  private notify(event: CommandRecognitionEvent): void {
    if (this.onEventCallback) {
      this.onEventCallback(event);
    }
  }
}
