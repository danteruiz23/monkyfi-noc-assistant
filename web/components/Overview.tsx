"use client";

import { useEffect, useState } from "react";
import { LANGS, STRINGS, logicText, type Lang } from "@/lib/i18n";

export interface OverviewData {
  incidentCount: number;
  eventCount: number;
  durationText: string;
  tickets: string[];
  probableCause: string;
  runbookId: string;
}

/** Phase 1 placeholder page: shows the ported logic's result in EN or ES. */
export default function Overview({ data }: { data: OverviewData }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("noc-language");
      if (saved === "en" || saved === "es") setLang(saved);
    } catch {
      // Storage can be blocked; English stays the default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("noc-language", lang);
    } catch {
      // Ignore blocked storage.
    }
  }, [lang]);

  const t = STRINGS[lang];
  return (
    <main>
      <header>
        <h1>
          Monkyfi <span>NOC Assistant</span>
        </h1>
        <div className="lang" role="group" aria-label={t.language}>
          {LANGS.map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <p className="tagline">{t.tagline}</p>
      <p className="status">{t.status}</p>

      <h2>{t.mainIncident}</h2>
      <div className="grid">
        <div className="card">
          <div className="label">{t.incidents}</div>
          <div className="value">{data.incidentCount}</div>
        </div>
        <div className="card">
          <div className="label">{t.events}</div>
          <div className="value" data-testid="event-count">{data.eventCount}</div>
        </div>
        <div className="card">
          <div className="label">{t.duration}</div>
          <div className="value" data-testid="duration">
            {data.durationText} {t.minutes}
          </div>
        </div>
        <div className="card">
          <div className="label">{t.tickets}</div>
          <div className="value tickets" data-testid="tickets">
            {data.tickets.map((id) => (
              <span key={id}>{id}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="label">{t.probableCause}</div>
        <div>{logicText(data.probableCause, lang)}</div>
        <div className="label" style={{ marginTop: 12 }}>{t.runbook}</div>
        <div>{data.runbookId}</div>
        <p className="note">{t.recommendation}</p>
      </div>

      <footer>{t.footer}</footer>
    </main>
  );
}
