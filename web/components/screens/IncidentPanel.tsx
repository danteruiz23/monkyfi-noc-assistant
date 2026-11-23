"use client";

import { pyFloatRepr, type AlertEvent, type Incident } from "@/lib";
import { dateTime, incidentDevices, incidentSeverity, incidentTitle } from "@/lib/localize";
import type { ScreenProps } from "../NocApp";
import { Empty, IdList, SeverityBadge, Stat } from "../ui";

/** Screen 1: every incident with severity, devices, duration and tickets. */
export default function IncidentPanel({
  t,
  lang,
  go,
  events,
  incidents,
  onOpen,
}: ScreenProps & { events: AlertEvent[]; incidents: Incident[]; onOpen: (id: string) => void }) {
  const ticketCount = incidents.reduce((n, inc) => n + inc.ticket_ids.length, 0);
  const perIncident = incidents.length ? Math.round(events.length / incidents.length) : 0;

  return (
    <section aria-labelledby="panel-title">
      <h2 id="panel-title">{t.panelTitle}</h2>
      <p className="intro">{t.panelIntro}</p>

      <div className="stats">
        <Stat label={t.statAlarms} value={events.length} testId="stat-alarms" />
        <Stat label={t.statIncidents} value={incidents.length} testId="stat-incidents" />
        <Stat label={t.statTickets} value={ticketCount} testId="stat-tickets" />
        <Stat label={t.statNoise} value={perIncident} />
      </div>

      {incidents.length === 0 ? (
        <Empty
          text={t.emptyPanel}
          action={
            <div className="row">
              <button type="button" className="btn" onClick={() => go("replay")}>
                {t.navReplay}
              </button>
              <button type="button" className="btn ghost" onClick={() => go("import")}>
                {t.navImport}
              </button>
            </div>
          }
        />
      ) : (
        <ul className="incident-list">
          {incidents.map((inc) => (
            <li key={inc.id} className="card incident" data-testid="incident-card">
              <div className="incident-head">
                <SeverityBadge severity={incidentSeverity(inc)} t={t} />
                <span className="mono id">{inc.id}</span>
              </div>
              <h3>{incidentTitle(inc, lang)}</h3>
              <dl className="facts">
                <div className="wide">
                  <dt>{t.colDevices}</dt>
                  <dd className="mono"><IdList items={incidentDevices(inc)} /></dd>
                </div>
                <div>
                  <dt>{t.colStart}</dt>
                  <dd className="mono">{dateTime(inc.start)}</dd>
                </div>
                <div>
                  <dt>{t.colDuration}</dt>
                  <dd data-testid="incident-duration">
                    {pyFloatRepr(inc.duration_minutes)} {t.minutes}
                  </dd>
                </div>
                <div>
                  <dt>{t.colAlarms}</dt>
                  <dd data-testid="incident-alarms">{inc.event_count}</dd>
                </div>
                <div className="wide">
                  <dt>{t.colTickets}</dt>
                  <dd className="mono" data-testid="incident-tickets">
                    {inc.ticket_ids.length ? <IdList items={inc.ticket_ids} /> : t.none}
                  </dd>
                </div>
              </dl>
              <div className="row">
                <button type="button" className="btn" onClick={() => onOpen(inc.id)}>
                  {t.openDetail}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
