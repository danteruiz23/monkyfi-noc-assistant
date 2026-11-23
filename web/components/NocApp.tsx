"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { correlate, parsePyJson, type AlertEvent, type Runbook } from "@/lib";
import { LANGS, STRINGS, fmt, type Lang, type StringKey, type Strings } from "@/lib/i18n";
import { DEFAULT_SPEED, replayDelay, replayOrder, type ReplaySpeed } from "@/lib/replay";
import IncidentPanel from "./screens/IncidentPanel";
import LiveReplay from "./screens/LiveReplay";
import IncidentDetail from "./screens/IncidentDetail";
import Remediation from "./screens/Remediation";
import ClosureSummary from "./screens/ClosureSummary";
import ImportAlarms, { type ImportStatus } from "./screens/ImportAlarms";
import AskQuestions, { type AskRequest, type ChatTurn } from "./screens/AskQuestions";

/** Raw data text from web/data/, parsed in the browser with parsePyJson (keeps 12.0 a float). */
export interface DemoData {
  alertsJson: string;
  runbooksJson: string;
  sampleSyslog: string;
}

export const SCREENS = ["incidents", "replay", "detail", "remediation", "summary", "import", "ask"] as const;
export type Screen = (typeof SCREENS)[number];

const NAV_KEYS: Record<Screen, StringKey> = {
  incidents: "navIncidents",
  replay: "navReplay",
  detail: "navDetail",
  remediation: "navRemediation",
  summary: "navSummary",
  import: "navImport",
  ask: "navAsk",
};

export type ReplayStatus = "idle" | "playing" | "paused" | "done";
export interface ReplayState {
  status: ReplayStatus;
  /** How many demo events have been shown so far. */
  index: number;
  speed: ReplaySpeed;
}

export interface ScreenProps {
  t: Strings;
  lang: Lang;
  go: (screen: Screen) => void;
}

function isScreen(value: string): value is Screen {
  return (SCREENS as readonly string[]).includes(value);
}

export default function NocApp({ data }: { data: DemoData }) {
  const demoEvents = useMemo(() => replayOrder(parsePyJson<AlertEvent[]>(data.alertsJson)), [data.alertsJson]);
  const runbooks = useMemo(() => parsePyJson<Runbook[]>(data.runbooksJson), [data.runbooksJson]);

  const [lang, setLang] = useState<Lang>("en");
  const [screen, setScreen] = useState<Screen>("incidents");
  const [events, setEvents] = useState<AlertEvent[]>(demoEvents);
  const [replay, setReplay] = useState<ReplayState>({ status: "idle", index: 0, speed: DEFAULT_SPEED });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [askDraft, setAskDraft] = useState("");

  // Language: remembered per browser; storage can be blocked, English stays the default.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("noc-language");
      if (saved === "en" || saved === "es") setLang(saved);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = STRINGS[lang].title;
    try {
      localStorage.setItem("noc-language", lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  // Screen in the URL hash, so a link can open one screen directly.
  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (isScreen(hash)) setScreen(hash);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = useCallback((next: Screen) => {
    setScreen(next);
    try {
      window.history.replaceState(null, "", `#${next}`);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  }, []);

  // Live replay: one demo event per tick, waiting the real (scaled) gap.
  useEffect(() => {
    if (replay.status !== "playing") return;
    if (replay.index >= demoEvents.length) {
      setReplay((r) => ({ ...r, status: "done" }));
      return;
    }
    const timer = window.setTimeout(() => {
      const next = replay.index + 1;
      setEvents(demoEvents.slice(0, next));
      setReplay((r) => (r.status === "playing" ? { ...r, index: next } : r));
    }, replayDelay(demoEvents, replay.index, replay.speed));
    return () => window.clearTimeout(timer);
  }, [replay.status, replay.index, replay.speed, demoEvents]);

  const replayControls = {
    start: () => {
      setEvents([]);
      setSelectedId(null);
      setReplay((r) => ({ ...r, status: "playing", index: 0 }));
    },
    pause: () => setReplay((r) => (r.status === "playing" ? { ...r, status: "paused" } : r)),
    resume: () => setReplay((r) => (r.status === "paused" ? { ...r, status: "playing" } : r)),
    setSpeed: (speed: ReplaySpeed) => setReplay((r) => ({ ...r, speed })),
  };

  const incidents = useMemo(() => correlate(events), [events]);
  const selected = incidents.find((i) => i.id === selectedId) ?? incidents[0] ?? null;

  // What the questions route needs to rebuild the alarms on screen: how many
  // demo alarms (the live replay shows a prefix) and the imported syslog lines.
  const askData = useMemo<AskRequest["data"]>(() => {
    const imported = events.filter((e) => e.source === "syslog-import");
    return {
      demo: events.length - imported.length,
      imported: imported.map((e) => e.syslog ?? "").join("\n"),
    };
  }, [events]);

  const addEvents = (added: AlertEvent[]) => {
    // An import ends any replay in progress, so the replay cannot overwrite it.
    setReplay((r) => ({ ...r, status: "idle", index: 0 }));
    setEvents((current) => [...current, ...added]);
  };
  const resetDemo = () => {
    setReplay((r) => ({ ...r, status: "idle", index: 0 }));
    setEvents(demoEvents);
    setSelectedId(null);
  };

  const t: Strings = STRINGS[lang];
  const common: ScreenProps = { t, lang, go };
  const replaying = replay.status === "playing" || replay.status === "paused";

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <div>
            <h1>
              {t.brand} <span>{t.product}</span>
            </h1>
            <p className="tagline">{t.tagline}</p>
          </div>
        </div>
        <div className="lang" role="group" aria-label={t.language}>
          {LANGS.map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <nav className="tabs" aria-label={t.navLabel}>
        {SCREENS.map((s, i) => (
          <button
            key={s}
            type="button"
            className="tab"
            aria-current={screen === s ? "page" : undefined}
            onClick={() => go(s)}
            data-screen={s}
          >
            <span className="num">{i + 1}</span>
            {t[NAV_KEYS[s]]}
          </button>
        ))}
      </nav>

      {replaying && screen !== "replay" && (
        <button type="button" className="banner" onClick={() => go("replay")}>
          {fmt(t.replayBanner, { n: replay.index, total: demoEvents.length })}
        </button>
      )}

      <main id="screen" data-screen={screen}>
        {screen === "incidents" && (
          <IncidentPanel
            {...common}
            events={events}
            incidents={incidents}
            onOpen={(id) => {
              setSelectedId(id);
              go("detail");
            }}
          />
        )}
        {screen === "replay" && (
          <LiveReplay
            {...common}
            total={demoEvents.length}
            events={events}
            incidents={incidents}
            replay={replay}
            controls={replayControls}
          />
        )}
        {screen === "detail" && (
          <IncidentDetail {...common} incidents={incidents} selected={selected} onSelect={setSelectedId} />
        )}
        {screen === "remediation" && (
          <Remediation
            {...common}
            incidents={incidents}
            selected={selected}
            onSelect={setSelectedId}
            runbooks={runbooks}
          />
        )}
        {screen === "summary" && (
          <ClosureSummary
            {...common}
            incidents={incidents}
            selected={selected}
            onSelect={setSelectedId}
            runbooks={runbooks}
            drafts={drafts}
            setDraft={(key, value) =>
              setDrafts((d) => {
                const next = { ...d };
                if (value === null) delete next[key];
                else next[key] = value;
                return next;
              })
            }
          />
        )}
        {screen === "import" && (
          <ImportAlarms
            {...common}
            events={events}
            demoCount={demoEvents.length}
            sample={data.sampleSyslog}
            text={importText}
            setText={setImportText}
            status={importStatus}
            setStatus={setImportStatus}
            onImport={addEvents}
            onReset={resetDemo}
          />
        )}
        {screen === "ask" && (
          <AskQuestions
            {...common}
            data={askData}
            chat={chat}
            setChat={(update) => setChat(update)}
            draft={askDraft}
            setDraft={setAskDraft}
          />
        )}
      </main>

      <footer className="foot">{t.footer}</footer>
    </div>
  );
}
