"use client";

import { useRef, type ChangeEvent } from "react";
import { MAX_IMPORT_BYTES, correlate, importAlarmText, type AlertEvent } from "@/lib";
import { fmt, logicText, type Strings } from "@/lib/i18n";
import type { ScreenProps } from "../NocApp";

/** The last import message. Text is kept as an i18n key + values so it follows the language. */
export type ImportStatus =
  | { kind: "ok"; imported: number; ignored: number; alarms: number; incidents: number }
  | { kind: "error"; key: keyof Strings }
  | { kind: "logicError"; text: string }
  | { kind: "info"; key: keyof Strings; vars: Record<string, string | number> };

function statusText(s: ImportStatus, t: Strings, lang: "en" | "es"): string {
  switch (s.kind) {
    case "ok":
      return `${fmt(t.impDone, { n: s.imported, m: s.ignored })} ${fmt(t.impResult, {
        alarms: s.alarms,
        incidents: s.incidents,
      })}`;
    case "error":
      return t[s.key];
    case "logicError":
      return logicText(s.text, lang);
    case "info":
      return fmt(t[s.key], s.vars);
  }
}

/** Screen 6: paste or upload simulator-style syslog alarms (same limits and filters as the backend). */
export default function ImportAlarms({
  t,
  lang,
  go,
  events,
  demoCount,
  sample,
  text,
  setText,
  status,
  setStatus,
  onImport,
  onReset,
}: ScreenProps & {
  events: AlertEvent[];
  demoCount: number;
  sample: string;
  text: string;
  setText: (text: string) => void;
  status: ImportStatus | null;
  setStatus: (status: ImportStatus | null) => void;
  onImport: (events: AlertEvent[]) => void;
  onReset: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isText = /\.txt$/i.test(file.name) && (file.type === "" || file.type.startsWith("text/"));
    if (!isText) {
      setStatus({ kind: "error", key: "impBadFile" });
      return;
    }
    // Refuse oversized files before reading them into the page.
    if (file.size > MAX_IMPORT_BYTES) {
      setStatus({ kind: "logicError", text: "Alarm text is too large (maximum 1 MB)." });
      return;
    }
    try {
      setText(await file.text());
      setStatus({ kind: "info", key: "impFileLoaded", vars: { name: file.name } });
    } catch {
      setStatus({ kind: "error", key: "impReadError" });
    }
  };

  const onAnalyze = () => {
    const result = importAlarmText(text, events.length);
    if (!result.ok) {
      setStatus({ kind: "logicError", text: result.error });
      return;
    }
    const next = [...events, ...result.events];
    let incidents: number;
    try {
      // Defence in depth: the parser already ignores lines with an impossible
      // date (phase 3), but never let a correlation error break the page.
      incidents = correlate(next).length;
    } catch {
      setStatus({ kind: "error", key: "impBadDate" });
      return;
    }
    onImport(result.events);
    setStatus({ kind: "ok", imported: result.imported, ignored: result.ignored, alarms: next.length, incidents });
  };

  const isError = status?.kind === "error" || status?.kind === "logicError";

  return (
    <section aria-labelledby="imp-title">
      <h2 id="imp-title">{t.impTitle}</h2>
      <p className="intro">{t.impIntro}</p>
      <p className="hint">{t.impLimits}</p>

      <div className="card">
        <label htmlFor="import-text" className="label">
          {t.impTextLabel}
        </label>
        <textarea
          id="import-text"
          className="syslog"
          spellCheck={false}
          rows={10}
          placeholder={t.impPlaceholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          data-testid="import-text"
        />
        <div className="row">
          <button type="button" className="btn" onClick={onAnalyze} data-testid="import-analyze">
            {t.impAnalyze}
          </button>
          <button type="button" className="btn ghost" onClick={() => fileInput.current?.click()}>
            {t.impFile}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,text/plain"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onFile}
          />
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setText(sample);
              setStatus(null);
            }}
            data-testid="import-sample"
          >
            {t.impSample}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              onReset();
              setStatus({ kind: "info", key: "impResetDone", vars: { n: demoCount } });
            }}
          >
            {t.impReset}
          </button>
        </div>
        {status && (
          <div className={`notice ${isError ? "error" : "ok"}`} role="status" data-testid="import-status">
            <span>{statusText(status, t, lang)}</span>
            {status.kind === "ok" && (
              <button type="button" className="btn small" onClick={() => go("incidents")}>
                {t.impSeeIncidents}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
