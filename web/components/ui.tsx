"use client";

import type { ReactNode } from "react";
import type { Incident } from "@/lib";
import type { Lang, Strings } from "@/lib/i18n";
import { alertTypeKey, incidentTitle, severityKey } from "@/lib/localize";

export function SeverityBadge({ severity, t }: { severity: string; t: Strings }) {
  const key = severityKey(severity);
  return <span className={`badge sev-${key ? severity : "unknown"}`}>{key ? t[key] : severity}</span>;
}

export function TypeBadge({ type, t }: { type: string; t: Strings }) {
  const key = alertTypeKey(type);
  return <span className={`tag type-${type.replace(/[^a-z_]/g, "")}`}>{key ? t[key] : type}</span>;
}

export function Stat({ label, value, testId }: { label: string; value: ReactNode; testId?: string }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="card empty">
      <p>{text}</p>
      {action}
    </div>
  );
}

export function RecommendationNote({ t }: { t: Strings }) {
  return (
    <div className="decision" role="note">
      <strong>{t.recommendation}</strong>
      <span>{t.humanControl}</span>
    </div>
  );
}

export function IncidentPicker({
  incidents,
  selected,
  onSelect,
  t,
  lang,
}: {
  incidents: Incident[];
  selected: Incident;
  onSelect: (id: string) => void;
  t: Strings;
  lang: Lang;
}) {
  return (
    <label className="picker">
      <span className="label">{t.selectIncident}</span>
      <select value={selected.id} onChange={(e) => onSelect(e.target.value)}>
        {incidents.map((inc) => (
          <option key={inc.id} value={inc.id}>
            {`${inc.id} · ${incidentTitle(inc, lang)}`}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NoIncident({ t, go }: { t: Strings; go: (s: "replay") => void }) {
  return (
    <Empty
      text={t.noIncident}
      action={
        <button type="button" className="btn" onClick={() => go("replay")}>
          {t.goReplay}
        </button>
      }
    />
  );
}

/** A comma-separated list of identifiers that never breaks inside a name (MIA-EDGE-02). */
export function IdList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, i) => (
        <span key={item} className="nw">
          {item}
          {i < items.length - 1 ? ", " : ""}
        </span>
      ))}
    </>
  );
}
