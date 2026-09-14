import type { SurahInfo } from "../quran/types.ts";

export interface NavigationCommand {
  surah: number;
  ayah: number;
  surahInfo: SurahInfo;
  rawText: string;
}

export interface ParseCommandSuccess {
  success: true;
  surah: number;
  ayah: number;
  surahInfo: SurahInfo;
  surahName: string;
  totalAyahs: number;
  rawText: string;
}

export interface ParseCommandFailure {
  success: false;
  reason: "invalid_surah" | "invalid_ayah" | "missing_ayah" | "unrecognized_command";
  message: string;
  rawText: string;
  surah?: number;
  ayah?: number;
  surahInfo?: SurahInfo;
  maxAyah?: number;
}

export type ParseCommandResult = ParseCommandSuccess | ParseCommandFailure;

export interface SelectedVerse {
  surah: number;
  ayah: number;
}

export interface CommandStatusEvent {
  type: "status";
  message: string;
}

export interface CommandTranscriptEvent {
  type: "transcript";
  transcript: string;
  isFinal: boolean;
}

export interface CommandResultEvent {
  type: "command_result";
  result: ParseCommandResult;
}

export interface CommandErrorEvent {
  type: "error";
  message: string;
}

export type CommandRecognitionEvent =
  | CommandStatusEvent
  | CommandTranscriptEvent
  | CommandResultEvent
  | CommandErrorEvent;

export interface VoiceCommandRecognizer {
  initialize(): Promise<void>;
  start(onEvent: (event: CommandRecognitionEvent) => void): Promise<void>;
  stop(): Promise<void>;
  dispose(): void;
  isSupported(): boolean;
}
