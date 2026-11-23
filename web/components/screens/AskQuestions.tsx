"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MAX_QUESTION_CHARS } from "@/lib/answers";
import { fmt, type Lang, type StringKey, type Strings } from "@/lib/i18n";
import {
  canSpeak,
  recognitionCtor,
  recognitionErrorKind,
  speakWithBrowser,
  speechLocale,
  stopBrowserSpeech,
  type Recognition,
} from "@/lib/voice";
import type { ScreenProps } from "../NocApp";
import { RecommendationNote } from "../ui";

/** What the browser sends to /api/ask (and to /api/tts to speak the same answer). */
export interface AskRequest {
  question: string;
  lang: Lang;
  data: { demo: number; imported: string };
}

export interface ChatTurn {
  id: number;
  question: string;
  answer: string;
  mode: string;
  lang: Lang;
  alarms?: number;
  incidents?: number;
  /** Kept so ElevenLabs can speak exactly this answer; null on a network error. */
  request: AskRequest | null;
}

export const DEMO_QUESTION_KEYS: StringKey[] = ["askQ1", "askQ2", "askQ3", "askQ4", "askQ5", "askQ6"];

/** Modes whose text is not spoken with ElevenLabs (the browser voice still reads them). */
const NOT_SPOKEN_BY_SERVER = new Set(["blocked", "reported", "error", "rate_limited"]);

function modeLabel(mode: string, t: Strings): string {
  if (mode === "answer") return t.askModeAnswer;
  if (mode === "human_control") return t.askModeHuman;
  if (mode === "reported") return t.askModeReported;
  return t.askModeFixed;
}

function codePoints(s: string): number {
  return Array.from(s).length;
}

type MicNote = "unsupported" | "denied" | "nothing" | null;

interface Props extends ScreenProps {
  data: AskRequest["data"];
  chat: ChatTurn[];
  setChat: (update: (turns: ChatTurn[]) => ChatTurn[]) => void;
  draft: string;
  setDraft: (text: string) => void;
}

export default function AskQuestions({ t, lang, data, chat, setChat, draft, setDraft }: Props) {
  const [busy, setBusy] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [provider, setProvider] = useState<"browser" | "elevenlabs">("browser");
  const [micSupported, setMicSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState<MicNote>(null);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const nextId = useRef(chat.length ? Math.max(...chat.map((c) => c.id)) + 1 : 1);

  // Feature detection runs in the browser only (the page is prerendered).
  useEffect(() => {
    setMicSupported(recognitionCtor() !== null);
    setSpeechSupported(canSpeak());
    let cancelled = false;
    fetch("/api/tts", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && body?.provider === "elevenlabs") setProvider("elevenlabs");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      recognition.current?.abort();
      stopBrowserSpeech();
      audio.current?.pause();
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    stopBrowserSpeech();
    if (audio.current) {
      audio.current.pause();
      audio.current = null;
    }
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    async (turn: ChatTurn) => {
      stopSpeaking();
      setSpeakingId(turn.id);
      const done = () => setSpeakingId((current) => (current === turn.id ? null : current));
      if (provider === "elevenlabs" && turn.request && !NOT_SPOKEN_BY_SERVER.has(turn.mode)) {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(turn.request),
          });
          if (res.ok) {
            const url = URL.createObjectURL(await res.blob());
            const player = new Audio(url);
            audio.current = player;
            player.onended = () => {
              URL.revokeObjectURL(url);
              done();
            };
            await player.play();
            return;
          }
        } catch {
          /* fall back to the browser voice */
        }
      }
      if (!speakWithBrowser(turn.answer, turn.lang, done)) done();
    },
    [provider, stopSpeaking],
  );

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      const request: AskRequest = { question: q, lang, data };
      setBusy(true);
      let turn: ChatTurn = { id: nextId.current++, question: q, answer: t.askNetworkError, mode: "error", lang, request: null };
      try {
        const res = await fetch(`/api/ask?lang=${lang}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        const body = await res.json().catch(() => null);
        if (body && typeof body.answer === "string") {
          turn = {
            ...turn,
            answer: body.answer,
            mode: typeof body.mode === "string" ? body.mode : "error",
            alarms: typeof body.alarms === "number" ? body.alarms : undefined,
            incidents: typeof body.incidents === "number" ? body.incidents : undefined,
            request,
          };
        }
      } catch {
        /* keep the network error turn */
      }
      setChat((turns) => [...turns, turn]);
      setDraft("");
      setBusy(false);
      if (readAloud) void speak(turn);
    },
    [busy, lang, data, t, setChat, setDraft, readAloud, speak],
  );

  const startDictation = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setMicNote("unsupported");
      return;
    }
    stopSpeaking();
    setMicNote(null);
    const rec = new Ctor();
    rec.lang = speechLocale(lang);
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = "";
    let failed = false;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setDraft(Array.from(finalText + interim).slice(0, MAX_QUESTION_CHARS).join(""));
    };
    rec.onerror = (e) => {
      const kind = recognitionErrorKind(e.error);
      if (kind !== "aborted") {
        failed = true;
        setMicNote(kind);
      }
    };
    rec.onend = () => {
      setListening(false);
      recognition.current = null;
      const spoken = Array.from(finalText.trim()).slice(0, MAX_QUESTION_CHARS).join("");
      if (spoken) void ask(spoken);
      else if (!failed) setMicNote("nothing");
    };
    try {
      rec.start();
      recognition.current = rec;
      setListening(true);
    } catch {
      setMicNote("denied");
    }
  };

  const stopDictation = () => recognition.current?.stop();

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(draft);
    }
  };

  const micText =
    micNote === "unsupported" || (!micSupported && micNote === null)
      ? t.askMicUnsupported
      : micNote === "denied"
        ? t.askMicDenied
        : micNote === "nothing"
          ? t.askMicNothing
          : null;

  return (
    <section aria-labelledby="ask-title">
      <h2 id="ask-title">{t.askTitle}</h2>
      <p className="intro">{t.askIntro}</p>
      <RecommendationNote t={t} />

      <div className="card">
        <div className="label" id="ask-demo-label">
          {t.askDemoLabel}
        </div>
        <div className="chips" role="group" aria-labelledby="ask-demo-label">
          {DEMO_QUESTION_KEYS.map((key, i) => (
            <button
              key={key}
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => void ask(t[key])}
              data-testid={`ask-demo-${i + 1}`}
            >
              {t[key]}
            </button>
          ))}
        </div>

        <label htmlFor="ask-input" className="label ask-label">
          {t.askInputLabel}
        </label>
        <textarea
          id="ask-input"
          className="ask-input"
          rows={2}
          maxLength={MAX_QUESTION_CHARS}
          placeholder={t.askPlaceholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          data-testid="ask-input"
        />
        <div className="hint ask-counter">{fmt(t.askCounter, { n: codePoints(draft), max: MAX_QUESTION_CHARS })}</div>
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={busy || !draft.trim()}
            onClick={() => void ask(draft)}
            data-testid="ask-send"
          >
            {busy ? t.askSending : t.askSend}
          </button>
          {micSupported && (
            <button
              type="button"
              className={`btn ghost${listening ? " recording" : ""}`}
              aria-pressed={listening}
              onClick={listening ? stopDictation : startDictation}
              disabled={busy}
              data-testid="ask-mic"
            >
              {listening ? t.askMicStop : t.askMic}
            </button>
          )}
          <label className="toggle">
            <input
              type="checkbox"
              checked={readAloud}
              disabled={!speechSupported && provider === "browser"}
              onChange={(e) => {
                setReadAloud(e.target.checked);
                if (!e.target.checked) stopSpeaking();
              }}
              data-testid="ask-read-aloud"
            />
            <span>{t.askReadAloud}</span>
          </label>
          {chat.length > 0 && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                stopSpeaking();
                setChat(() => []);
              }}
              data-testid="ask-clear"
            >
              {t.askClear}
            </button>
          )}
        </div>
        {listening && (
          <p className="hint live-hint" role="status">
            {t.askListening}
          </p>
        )}
        {micText && <p className="hint">{micText}</p>}
        <p className="hint">
          {provider === "elevenlabs" ? t.askVoiceEleven : speechSupported ? t.askVoiceBrowser : t.askSpeechUnsupported}
        </p>
      </div>

      <div className="card chat" aria-live="polite" data-testid="ask-chat">
        {chat.length === 0 ? (
          <p className="muted">{t.askEmpty}</p>
        ) : (
          <ol className="turns">
            {chat.map((turn) => (
              <li key={turn.id} className="turn" data-mode={turn.mode} data-testid="ask-turn">
                <div className="bubble you">
                  <span className="who">{t.askYou}</span>
                  <p>{turn.question}</p>
                </div>
                <div className={`bubble assistant mode-${turn.mode}`}>
                  <span className="who">
                    {t.askAssistant} <span className="badge mode">{modeLabel(turn.mode, t)}</span>
                  </span>
                  <p lang={turn.lang} data-testid="ask-answer">
                    {turn.answer}
                  </p>
                  <div className="turn-foot">
                    {turn.mode === "answer" && turn.alarms !== undefined && turn.incidents !== undefined && (
                      <span className="muted small">
                        {fmt(t.askDataNote, { alarms: turn.alarms, incidents: turn.incidents })}
                      </span>
                    )}
                    {(speechSupported || provider === "elevenlabs") && (
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => (speakingId === turn.id ? stopSpeaking() : void speak(turn))}
                      >
                        {speakingId === turn.id ? t.askStop : t.askListen}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
