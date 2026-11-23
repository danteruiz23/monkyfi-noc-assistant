"use client";

import { affectedCustomers, peakPacketLoss, peakUtilization, pyFloatRepr, pyStr, type Incident } from "@/lib";
import { fmt, logicText } from "@/lib/i18n";
import {
  alarmMessage,
  causalChain,
  clock,
  dateTime,
  incidentDevices,
  incidentSeverity,
  incidentTitle,
} from "@/lib/localize";
import type { ScreenProps } from "../NocApp";
import { IdList, IncidentPicker, NoIncident, SeverityBadge, Stat, TypeBadge } from "../ui";

/** Screen 3: timeline, causal chain, affected customers and merged tickets. */
export default function IncidentDetail({
  t,
  lang,
  go,
  incidents,
  selected,
  onSelect,
}: ScreenProps & { incidents: Incident[]; selected: Incident | null; onSelect: (id: string) => void }) {
  if (!selected) {
    return (
      <section aria-labelledby="detail-title">
        <h2 id="detail-title">{t.detailTitle}</h2>
        <NoIncident t={t} go={go} />
      </section>
    );
  }
  const inc = selected;
  const chain = causalChain(inc);
  const customers = affectedCustomers(inc);

  return (
    <section aria-labelledby="detail-title">
      <h2 id="detail-title">{t.detailTitle}</h2>
      <IncidentPicker incidents={incidents} selected={inc} onSelect={onSelect} t={t} lang={lang} />

      <div className="card hero">
        <div className="incident-head">
          <SeverityBadge severity={incidentSeverity(inc)} t={t} />
          <span className="mono id">{inc.id}</span>
        </div>
        <h3>{incidentTitle(inc, lang)}</h3>
        <p>
          <span className="label">{t.probableCause}: </span>
          <strong data-testid="probable-cause">{logicText(inc.probable_cause, lang)}</strong>
        </p>
        <p className="mono small">
          <span className="label">{t.window}: </span>
          {dateTime(inc.start)} → {dateTime(inc.end)}
        </p>
      </div>

      <div className="stats">
        <Stat label={t.events} value={inc.event_count} testId="detail-events" />
        <Stat
          label={t.duration}
          value={`${pyFloatRepr(inc.duration_minutes)} ${t.minutes}`}
          testId="detail-duration"
        />
        <Stat label={t.peakUtil} value={`${pyStr(peakUtilization(inc))}%`} />
        <Stat label={t.peakLoss} value={`${pyStr(peakPacketLoss(inc))}%`} />
      </div>

      <h3>{t.causalChain}</h3>
      <ol className="chain" data-testid="causal-chain">
        {chain.map((step) => (
          <li key={step.alert_type} className="card">
            <TypeBadge type={step.alert_type} t={t} />
            <span className="mono">{clock(step.timestamp)}</span>
            <span className="mono small">
              {step.device} {step.interface}
            </span>
            {step.peak !== undefined && <strong className="peak">{step.peak}%</strong>}
          </li>
        ))}
        {customers.length > 0 && (
          <li className="card impact">
            <span className="tag type-impact">{t.chainImpact}</span>
            <strong>{customers.join(", ")}</strong>
          </li>
        )}
      </ol>
      <p className="hint">{t.chainNote}</p>

      <div className="split">
        <div className="card">
          <h3>{t.customers}</h3>
          {customers.length ? (
            <ul className="plain" data-testid="customers">
              {customers.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t.noneReported}</p>
          )}
          <h3>{t.devices}</h3>
          <p className="mono">
            <IdList items={incidentDevices(inc)} />
          </p>
        </div>
        <div className="card">
          <h3>{t.tickets}</h3>
          {inc.ticket_ids.length === 0 ? (
            <p className="muted">{t.none}</p>
          ) : (
            <ul className="tickets" data-testid="merged-tickets">
              {inc.ticket_ids.map((id) => (
                <li key={id}>
                  <strong className="mono">{id}</strong>
                  <ul className="plain small">
                    {inc.events
                      .filter((e) => e.ticket_id === id)
                      .map((e) => (
                        <li key={e.event_id}>
                          <span className="mono">{clock(e.timestamp)}</span>{" "}
                          <span className="label">
                            {e.ticket_action === "created" ? t.ticketOpened : t.ticketUpdated}:
                          </span>{" "}
                          {alarmMessage(e.message, lang)}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h3>
        {t.timeline} <span className="muted small">({fmt(t.timelineCount, { n: inc.event_count })})</span>
      </h3>
      <ol className="feed timeline" data-testid="timeline">
        {inc.events.map((e) => (
          <li key={e.event_id}>
            <span className="mono time">{clock(e.timestamp)}</span>
            <TypeBadge type={e.alert_type} t={t} />
            <SeverityBadge severity={e.severity} t={t} />
            <span className="mono dev">
              {e.device} {e.interface}
            </span>
            <span className="msg">{alarmMessage(e.message, lang)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
