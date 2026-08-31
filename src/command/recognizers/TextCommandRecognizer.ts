import { parseNavigationCommand } from "../commandParser.ts";
import type { CommandRecognitionEvent, VoiceCommandRecognizer } from "../types.ts";

export class TextCommandRecognizer implements VoiceCommandRecognizer {
  private onEventCallback: ((event: CommandRecognitionEvent) => void) | null = null;

  public isSupported(): boolean {
    return true;
  }

  public async initialize(): Promise<void> {}

  public async start(onEvent: (event: CommandRecognitionEvent) => void): Promise<void> {
    this.onEventCallback = onEvent;
    onEvent({
      type: "status",
      message: "Input teks perintah siap."
    });
  }

  public submitText(input: string): void {
    if (!this.onEventCallback) return;

    this.onEventCallback({
      type: "transcript",
      transcript: input,
      isFinal: true
    });

    const result = parseNavigationCommand(input);
    this.onEventCallback({
      type: "command_result",
      result
    });
  }

  public async stop(): Promise<void> {}

  public dispose(): void {
    this.onEventCallback = null;
  }
}
