/**
 * POST /api/ask: one question about the current incident.
 *
 * Order of checks: same origin -> JSON content type -> rate limit -> body
 * size -> JSON shape -> alarm data limits -> guardrails (lib/guardrails.ts)
 * -> answer from the data. No AI and no key: every answer is built from the
 * synthetic demo data plus the alarm lines the browser has imported.
 *
 * Request:  { question: string, lang?: "en" | "es", data?: { demo?: number, imported?: string } }
 *   data.demo      how many demo alarms are on screen (the live replay shows a prefix; default all)
 *   data.imported  the imported syslog lines, re-parsed here with the same limits and filters
 * Response: { answer, mode, intent, attempt, lang, alarms, incidents }
 */
import "server-only";
import {
  assessQuestion,
  countsAsStrike,
  finalMode,
  guardrailLogEntry,
  RateLimiter,
  replyText,
  StrikeCounter,
  type Assessment,
  type AskMode,
} from "../guardrails";
import { correlate, TimestampError } from "../correlator";
import { loadAlerts, loadRunbooks } from "../data";
import { STRINGS, type Lang } from "../i18n";
import { replayOrder } from "../replay";
import { importLimitError, MAX_IMPORT_BYTES, parseSyslogText } from "../syslog";
import type { AlertEvent, Runbook } from "../types";
import { clientKey, json, readBody, sameOrigin } from "./http";

/** Imported alarm text (1 MB) plus room for the question and the JSON. */
export const MAX_ASK_BODY_BYTES = MAX_IMPORT_BYTES + 64 * 1024;
/** Questions per client: 20 per minute and 300 per hour (best effort per server instance). */
export const ASK_LIMITS = { perMinute: 20, perHour: 300 } as const;

export interface AskDeps {
  strikes: StrikeCounter;
  minute: RateLimiter;
  hour: RateLimiter;
  /** Where blocked attempts and reports go (server log by default). */
  log: (entry: Record<string, unknown>) => void;
  /** Per-turn trace without the content (server log by default). */
  trace: (entry: Record<string, unknown>) => void;
  now: () => number;
}

export function createAskDeps(now: () => number = Date.now): AskDeps {
  return {
    strikes: new StrikeCounter(60 * 60 * 1000, now),
    minute: new RateLimiter(ASK_LIMITS.perMinute, 60 * 1000, now),
    hour: new RateLimiter(ASK_LIMITS.perHour, 60 * 60 * 1000, now),
    log: (entry) => console.warn(JSON.stringify(entry)),
    trace: (entry) => console.info(JSON.stringify(entry)),
    now,
  };
}

let defaultDeps: AskDeps | null = null;
function getDefaultDeps(): AskDeps {
  defaultDeps ??= createAskDeps();
  return defaultDeps;
}

let demoCache: { events: AlertEvent[]; runbooks: Runbook[] } | null = null;
/** The 50 demo alarms in replay order, and the runbooks (read once per instance). */
export function demoData() {
  demoCache ??= { events: replayOrder(loadAlerts()), runbooks: loadRunbooks() };
  return demoCache;
}

function parseLang(value: unknown): Lang {
  return value === "es" ? "es" : "en";
}

/** The events the browser is showing, rebuilt from the demo data and the imported lines. */
export function currentEvents(data: unknown): { ok: true; events: AlertEvent[] } | { ok: false } {
  const demo = demoData().events;
  if (data === undefined || data === null) return { ok: true, events: demo };
  if (typeof data !== "object" || Array.isArray(data)) return { ok: false };
  const { demo: count = demo.length, imported = "" } = data as { demo?: unknown; imported?: unknown };
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0 || count > demo.length) return { ok: false };
  if (typeof imported !== "string") return { ok: false };
  const events = demo.slice(0, count);
  if (imported.trim()) {
    // Same limits and filters as the import screen; alarm text is data, never instructions.
    if (importLimitError(imported)) return { ok: false };
    events.push(...parseSyslogText(imported, count).events);
  }
  return { ok: true, events };
}

export async function handleAsk(req: Request, deps: AskDeps = getDefaultDeps()): Promise<Response> {
  const started = deps.now();
  if (!sameOrigin(req)) return json({ error: "forbidden", mode: "error" }, 403);
  const type = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) return json({ error: "unsupported_media_type", mode: "error" }, 415);

  const client = clientKey(req);
  const hint = parseLang(new URL(req.url).searchParams.get("lang"));
  for (const limiter of [deps.minute, deps.hour]) {
    const { ok, retryAfter } = limiter.hit(client);
    if (!ok) {
      return json({ answer: STRINGS[hint].askBusy, mode: "rate_limited", lang: hint }, 429, {
        "Retry-After": String(retryAfter),
      });
    }
  }

  const body = await readBody(req, MAX_ASK_BODY_BYTES);
  if (!body.ok) {
    const key = body.status === 413 ? "askDataError" : "askBadRequest";
    return json({ answer: STRINGS[hint][key], mode: "error", lang: hint }, body.status);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return json({ answer: STRINGS[hint].askBadRequest, mode: "error", lang: hint }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ answer: STRINGS[hint].askBadRequest, mode: "error", lang: hint }, 400);
  }
  const { question, lang: rawLang, data } = payload as { question?: unknown; lang?: unknown; data?: unknown };
  const lang = rawLang === undefined ? hint : parseLang(rawLang);
  if (question !== undefined && typeof question !== "string") {
    return json({ answer: STRINGS[lang].askBadRequest, mode: "error", lang }, 400);
  }

  const current = currentEvents(data);
  if (!current.ok) return json({ answer: STRINGS[lang].askDataError, mode: "error", lang }, 400);

  let assessment: Assessment;
  let incidents: number;
  try {
    incidents = correlate(current.events).length;
    assessment = assessQuestion(question ?? "", current.events, demoData().runbooks);
  } catch (err) {
    if (err instanceof TimestampError) return json({ answer: STRINGS[lang].askDataError, mode: "error", lang }, 400);
    throw err;
  }

  let attempt = deps.strikes.current(client);
  if (countsAsStrike(assessment.intent)) {
    attempt = deps.strikes.add(client);
    // The "reported" reply is only honest because this line is written.
    deps.log(
      guardrailLogEntry({
        intent: assessment.intent,
        reason: assessment.reason,
        attempt,
        lang,
        message: typeof question === "string" ? question : "",
        client,
        at: new Date(deps.now()),
      }),
    );
  }
  const mode: AskMode = finalMode(assessment, attempt);
  const answer = replyText(assessment, lang, attempt);
  deps.trace({
    event: "ask",
    agent: "monkyfi-noc-assistant",
    client,
    intent: assessment.intent,
    mode,
    lang,
    ms: deps.now() - started,
    at: new Date(deps.now()).toISOString(),
  });
  return json({
    answer,
    mode,
    intent: assessment.intent,
    attempt,
    lang,
    alarms: current.events.length,
    incidents,
  });
}
