"use client";

import { pyFloatRepr, type AlertEvent, type Incident } from "@/lib";
import { fmt } from "@/lib/i18n";
import { alarmMessage, clock, incidentSeverity, incidentTitle } from "@/lib/localize";
import { REPLAY_SPEEDS, type ReplaySpeed } from "@/lib/replay";
import type { ReplayState, ScreenProps } from "../NocApp";
import { SeverityBadge, TypeBadge } from "../ui";

interface Controls {
  start: () => void;
  pause: () => void;
  resume: () => void;
  setSpeed: (speed: ReplaySpeed) => void;
}

/** Screen 2: replay the 50 simulator alarms in the browser and watch incidents form. */
export default function LiveReplay({
  t,
  lang,
  total,
  events,
  incidents,
  replay,
  controls,
}: ScreenProps & {
  total: number;
  events: AlertEvent[];
  incidents: Incident[];
  replay: ReplayState;
  controls: Controls;
}) {
  const { status, index, speed } = replay;
  const shown = status === "idle" ? 0 : index;
  const last = status === "idle" ? undefined : events[events.length - 1];
  const feed = status === "idle" ? [] : [...events].reverse();
  const percent = total ? Math.round((shown / total) * 100) : 0;

  let message: string;
  if (status === "idle") message = t.replayIdle;
  else if (status === "paused") message = t.replayPaused;
  else if (status === "done") message = fmt(t.replayDone, { alarms: events.length, incidents: incidents.length });
  else message = fmt(t.progress, { n: shown, total });

  return (
    <section aria-labelledby="replay-title">
      <h2 id="replay-title">{t.replayTitle}</h2>
      <p className="intro">{t.replayIntro}</p>

      <div className="card controls">
        <div className="row">
          {status === "playing" ? (
            <button type="button" className="btn" onClick={controls.pause} data-testid="replay-pause">
              {t.pause}
            </button>
          ) : status === "paused" ? (
            <button type="button" className="btn" onClick={controls.resume} data-testid="replay-resume">
              {t.resume}
            </button>
          ) : (
            <button type="button" className="btn" onClick={controls.start} data-testid="replay-play">
              {status === "done" ? t.restart : t.play}
            </button>
          )}
          {(status === "playing" || status === "paused") && (
            <button type="button" className="btn ghost" onClick={controls.start}>
              {t.restart}
            </button>
          )}
          <label className="speed">
            <span>{t.speed}</span>
            <select
              value={speed}
              onChange={(e) => controls.setSpeed(Number(e.target.value) as ReplaySpeed)}
            >
              {REPLAY_SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {fmt(t.speedOption, { n: s })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={shown}
          aria-label={fmt(t.progress, { n: shown, total })}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="replay-status">
          <p aria-live="polite" data-testid="replay-message">
            {message}
          </p>
          <p className="clock">
            <span className="label">{t.simClock}</span>{" "}
            <span className="mono" data-testid="replay-clock">
              {last ? clock(last.timestamp) : "--:--:--"}
            </span>
          </p>
        </div>
      </div>

      <div className="split">
        <div>
          <h3>{t.liveIncidents}</h3>
          {status === "idle" || incidents.length === 0 ? (
            <p className="muted">{t.feedEmpty}</p>
          ) : (
            <ul className="incident-list compact">
              {incidents.map((inc) => (
                <li key={inc.id} className="card incident live" data-testid="live-incident">
                  <div className="incident-head">
                    <SeverityBadge severity={incidentSeverity(inc)} t={t} />
                    <span className="mono id">{inc.id}</span>
                  </div>
                  <h4>{incidentTitle(inc, lang)}</h4>
                  <dl className="facts">
                    <div>
                      <dt>{t.colAlarms}</dt>
                      <dd>{inc.event_count}</dd>
                    </div>
                    <div>
                      <dt>{t.colDuration}</dt>
                      <dd>
                        {pyFloatRepr(inc.duration_minutes)} {t.minutes}
                      </dd>
                    </div>
                    <div>
                      <dt>{t.colTickets}</dt>
                      <dd className="mono">{inc.ticket_ids.length ? inc.ticket_ids.join(", ") : t.none}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3>{t.liveFeed}</h3>
          {feed.length === 0 ? (
            <p className="muted">{t.feedEmpty}</p>
          ) : (
            <ol className="feed" data-testid="replay-feed">
              {feed.map((e) => (
                <li key={e.event_id}>
                  <span className="mono time">{clock(e.timestamp)}</span>
                  <TypeBadge type={e.alert_type} t={t} />
                  <SeverityBadge severity={e.severity} t={t} />
                  <span className="mono dev">{e.device}</span>
                  <span className="msg">{alarmMessage(e.message, lang)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
