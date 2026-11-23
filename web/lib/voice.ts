/**
 * Browser voice for the questions screen: dictation with the Web Speech API
 * (SpeechRecognition) and read-aloud with speechSynthesis. Both are built
 * into the browser: no cost, no key, no audio sent to our server.
 * ElevenLabs read-aloud is optional and server-side (lib/server/tts.ts).
 */
import type { Lang } from "./i18n";

/** Browser locale used for dictation and read-aloud. */
export function speechLocale(lang: Lang): string {
  return lang === "es" ? "es-ES" : "en-US";
}

/* Minimal typings: SpeechRecognition is not in the TypeScript DOM library everywhere. */
export interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
export interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

/** The SpeechRecognition constructor, or null where the browser has none (e.g. Firefox). */
export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Map a recognition error code to the kind of message the screen shows. */
export function recognitionErrorKind(code: string): "denied" | "nothing" | "aborted" {
  if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") return "denied";
  if (code === "aborted") return "aborted";
  return "nothing";
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Pick a voice for the language: exact locale first, then any voice of that language. */
export function pickVoice<T extends { lang: string }>(voices: readonly T[], lang: Lang): T | null {
  const locale = speechLocale(lang).toLowerCase();
  const prefix = lang.toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase().replace("_", "-") === locale) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}

/** Read a text aloud with the browser voice. Returns false when the browser cannot speak. */
export function speakWithBrowser(text: string, lang: Lang, onEnd: () => void): boolean {
  if (!canSpeak()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLocale(lang);
  const voice = pickVoice(synth.getVoices(), lang);
  if (voice) utterance.voice = voice;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  synth.speak(utterance);
  return true;
}

export function stopBrowserSpeech(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
