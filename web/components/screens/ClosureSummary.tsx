"use client";

import { useState } from "react";
import { suggest, type Incident, type Runbook } from "@/lib";
import { closureSummary } from "@/lib/localize";
import type { ScreenProps } from "../NocApp";
import { IncidentPicker, NoIncident, RecommendationNote } from "../ui";

type Notice = "copied" | "copyFailed" | "exported" | null;

/** Copy text: the async clipboard API first, then the older execCommand fallback. */
async function copyText(text: string, area: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!area) return false;
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
}

/** Screen 5: editable closure summary draft, with copy and export. */
export default function ClosureSummary({
  t,
  lang,
  go,
  incidents,
  selected,
  onSelect,
  runbooks,
  drafts,
  setDraft,
}: ScreenProps & {
  incidents: Incident[];
  selected: Incident | null;
  onSelect: (id: string) => void;
  runbooks: Runbook[];
  drafts: Record<string, string>;
  setDraft: (key: string, value: string | null) => void;
}) {
  const [notice, setNotice] = useState<Notice>(null);

  if (!selected) {
    return (
      <section aria-labelledby="sum-title">
        <h2 id="sum-title">{t.sumTitle}</h2>
        <NoIncident t={t} go={go} />
      </section>
    );
  }

  const original = closureSummary(selected, suggest(selected, runbooks), lang);
  // A draft belongs to one incident, language and alarm count; new alarms start a fresh draft.
  const key = `${selected.id}|${lang}|${selected.event_count}`;
  const text = drafts[key] ?? original;
  const edited = drafts[key] !== undefined && drafts[key] !== original;

  const onCopy = async () => {
    const area = document.getElementById("summary-text") as HTMLTextAreaElement | null;
    setNotice((await copyText(text, area)) ? "copied" : "copyFailed");
  };
  const onExport = () => {
    const blob = new Blob([text.endsWith("\n") ? text : `${text}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.id}-closure-${lang}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("exported");
  };

  return (
    <section aria-labelledby="sum-title">
      <h2 id="sum-title">{t.sumTitle}</h2>
      <p className="intro">{t.sumIntro}</p>
      <IncidentPicker
        incidents={incidents}
        selected={selected}
        onSelect={(id) => {
          setNotice(null);
          onSelect(id);
        }}
        t={t}
        lang={lang}
      />

      <div className="card">
        <div className="incident-head">
          <label htmlFor="summary-text" className="label">
            {t.draftLabel}
          </label>
          {edited && <span className="tag">{t.edited}</span>}
        </div>
        <textarea
          id="summary-text"
          className="summary"
          spellCheck={false}
          value={text}
          rows={Math.min(28, text.split("\n").length + 2)}
          onChange={(e) => {
            setNotice(null);
            setDraft(key, e.target.value);
          }}
          data-testid="summary-text"
        />
        <div className="row">
          <button type="button" className="btn" onClick={onCopy}>
            {t.copy}
          </button>
          <button type="button" className="btn ghost" onClick={onExport}>
            {t.download}
          </button>
          <button type="button" className="btn ghost" onClick={() => setDraft(key, null)} disabled={!edited}>
            {t.restore}
          </button>
          <span className="muted" aria-live="polite" data-testid="summary-notice">
            {notice ? t[notice] : ""}
          </span>
        </div>
      </div>
      <RecommendationNote t={t} />
    </section>
  );
}
