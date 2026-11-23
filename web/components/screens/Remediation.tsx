"use client";

import { pyStr, suggest, type Incident, type Runbook, type Suggestion } from "@/lib";
import { fmt, logicText, type Lang, type Strings } from "@/lib/i18n";
import { incidentTitle, mttrSaving, remediationText } from "@/lib/localize";
import type { ScreenProps } from "../NocApp";
import { IncidentPicker, NoIncident, RecommendationNote } from "../ui";

function RunbookCard({
  s,
  runbook,
  heading,
  t,
  lang,
  main,
}: {
  s: Suggestion;
  runbook: Runbook | undefined;
  heading: string;
  t: Strings;
  lang: Lang;
  main?: boolean;
}) {
  const saving = mttrSaving(s.mttr_before_min, s.mttr_after_min);
  const max = Math.max(s.mttr_before_min, s.mttr_after_min, 1);
  return (
    <article className={`card runbook${main ? " main" : ""}`} data-testid={main ? "runbook-main" : "runbook-alt"}>
      <div className="incident-head">
        <span className="label">{heading}</span>
        <span className="mono id">{s.runbook_id}</span>
      </div>
      <dl className="stack">
        <div>
          <dt>{t.symptom}</dt>
          <dd>{logicText(s.symptom, lang)}</dd>
        </div>
        <div>
          <dt>{t.rootCause}</dt>
          <dd>{logicText(s.root_cause, lang)}</dd>
        </div>
        <div>
          <dt>{t.action}</dt>
          <dd className="action">{logicText(s.recommended_action, lang)}</dd>
        </div>
        <div>
          <dt>{t.matched}</dt>
          <dd>
            <span className="keywords">
              {s.matched_terms.map((k) => (
                <code key={k}>{k}</code>
              ))}
            </span>{" "}
            <span className="muted small">
              {fmt(t.score, { n: s.score, total: runbook ? runbook.keywords.length : s.score })}
            </span>
          </dd>
        </div>
      </dl>
      <div className="mttr" aria-label={t.mttr}>
        <div className="label">{t.mttr}</div>
        <div className="bar-row">
          <span className="bar-label">{t.mttrBefore}</span>
          <span className="bar before" style={{ width: `${(s.mttr_before_min / max) * 100}%` }} />
          <span className="mono">
            {pyStr(s.mttr_before_min)} {t.minutes}
          </span>
        </div>
        <div className="bar-row">
          <span className="bar-label">{t.mttrAfter}</span>
          <span className="bar after" style={{ width: `${(s.mttr_after_min / max) * 100}%` }} />
          <span className="mono">
            {pyStr(s.mttr_after_min)} {t.minutes}
          </span>
        </div>
        <p className="saving" data-testid="mttr-saving">
          {fmt(t.mttrSaving, { n: saving })}
        </p>
      </div>
    </article>
  );
}

/** Screen 4: suggested runbook, probable cause and MTTR before/after. Always a recommendation. */
export default function Remediation({
  t,
  lang,
  go,
  incidents,
  selected,
  onSelect,
  runbooks,
}: ScreenProps & {
  incidents: Incident[];
  selected: Incident | null;
  onSelect: (id: string) => void;
  runbooks: Runbook[];
}) {
  if (!selected) {
    return (
      <section aria-labelledby="rem-title">
        <h2 id="rem-title">{t.remTitle}</h2>
        <NoIncident t={t} go={go} />
      </section>
    );
  }
  const suggestions = suggest(selected, runbooks);
  const byId = new Map(runbooks.map((rb) => [rb.id, rb]));
  const [top, alt] = suggestions;

  return (
    <section aria-labelledby="rem-title">
      <h2 id="rem-title">{t.remTitle}</h2>
      <p className="intro">{t.remIntro}</p>
      <IncidentPicker incidents={incidents} selected={selected} onSelect={onSelect} t={t} lang={lang} />
      <RecommendationNote t={t} />

      <div className="card hero">
        <h3>{incidentTitle(selected, lang)}</h3>
        <p>
          <span className="label">{t.probableCause}: </span>
          <strong>{logicText(selected.probable_cause, lang)}</strong>
        </p>
        {!top && (
          <p className="muted" data-testid="remediation-text">
            {remediationText(selected, suggestions, lang)}
          </p>
        )}
      </div>

      {top && (
        <div className="split even">
          <RunbookCard s={top} runbook={byId.get(top.runbook_id)} heading={t.runbook} t={t} lang={lang} main />
          {alt && (
            <RunbookCard s={alt} runbook={byId.get(alt.runbook_id)} heading={t.alternative} t={t} lang={lang} />
          )}
        </div>
      )}
    </section>
  );
}
