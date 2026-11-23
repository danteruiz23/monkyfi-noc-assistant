/**
 * Port of the alarm import in backend/app.py (parse_syslog_text,
 * import_limit_error and the POST /alerts/import checks).
 *
 * Alarm text is data, never instructions: lines with HTML tags, script tags
 * or destructive shell commands are dropped and counted, never parsed.
 * Lines with an impossible timestamp (month 13, 31-nov, 24:00, second 60)
 * are dropped and counted too, so correlate() never fails on imported data.
 */
import {
  PyFloat,
  ignoreCaseInput,
  isPyNumber,
  pyLen,
  pyParseFloat,
  pyParseInt,
  pyRegex,
  pySplitlines,
  pyStr,
  pyStrip,
  utf8Length,
} from "./py";
import { TimestampError, parseTimestamp } from "./correlator";
import type { AlertEvent, MetricValue } from "./types";

export const MAX_IMPORT_BYTES = 1024 * 1024;
export const MAX_IMPORT_LINE_CHARS = 4096;
export const MAX_IMPORT_LINES = 5000;

const SUSPICIOUS_LINE = pyRegex(
  "(?:" +
    "<\\s*/?\\s*script\\b|" +
    "<\\s*/?\\s*[a-zA-Z][^>\\n]*>|" +
    "\\brm\\s+(?:-\\S+\\s+)*-(?:[a-z]*r[a-z]*f|[a-z]*f[a-z]*r)\\b" +
    ")",
  "i",
);

const SYSLOG_PATTERN = pyRegex(
  "^<\\d+>\\d+ (\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\dZ) " + "(\\S+) (\\S+): (\\S+) (\\w+)=([^ ]+) (.*)$",
);

export const SYSLOG_TYPES: Record<string, string> = {
  "BGP-5-ADJCHANGE": "bgp_flap",
  "LINK-4-UTILIZATION": "link_saturation",
  "QOS-3-PACKETLOSS": "packet_loss",
  "OPTIC-4-RXPOWER": "optical_degradation",
  "NOC-6-TICKET": "ticket",
};

export interface ParseResult {
  events: AlertEvent[];
  /** Lines that were ignored: suspicious, malformed, of an unknown type or with an impossible timestamp. */
  invalid: number;
}

/** Python: float(raw) if it has ".", "e" or "E", else int(raw); the text if that fails. */
function parseValue(raw: string): MetricValue {
  const parsed = /[.eE]/.test(raw) ? pyParseFloat(raw) : pyParseInt(raw);
  return parsed === undefined ? raw : parsed;
}

/** Python: _parse_ts(timestamp) does not raise ValueError. */
function isValidTimestamp(ts: string): boolean {
  try {
    parseTimestamp(ts);
    return true;
  } catch (err) {
    if (err instanceof TimestampError) return false;
    throw err;
  }
}

/** Python: isinstance(value, (int, float)) and value >= threshold. */
function atLeast(value: MetricValue, threshold: number): boolean {
  if (!isPyNumber(value)) return false;
  const v = value instanceof PyFloat ? value.value : value;
  return (v as number) >= threshold;
}

/**
 * Parse simulator-style syslog lines into alert events.
 * `existingCount` is how many events are already stored; it numbers the ids
 * (import-000001, ...) the same way the backend does.
 */
export function parseSyslogText(text: string, existingCount = 0): ParseResult {
  const events: AlertEvent[] = [];
  let invalid = 0;
  for (const rawLine of pySplitlines(text)) {
    const line = pyStrip(rawLine);
    if (!line) continue;
    if (SUSPICIOUS_LINE.test(ignoreCaseInput(rawLine))) {
      invalid++;
      continue;
    }
    const match = SYSLOG_PATTERN.exec(line);
    if (!match) {
      invalid++;
      continue;
    }
    const [, timestamp, device, code, iface, metricName, rawValue, message] = match;
    const alertType = SYSLOG_TYPES[code];
    if (!alertType) {
      invalid++;
      continue;
    }
    if (!isValidTimestamp(timestamp)) {
      invalid++;
      continue;
    }
    const value = parseValue(rawValue);
    let severity = "major";
    if (alertType === "bgp_flap" && metricName === "bgp_neighbor_state" && value === "down") {
      severity = "critical";
    } else if (alertType === "link_saturation" && atLeast(value, 95)) {
      severity = "critical";
    } else if (alertType === "packet_loss" && atLeast(value, 10)) {
      severity = "critical";
    }
    const event: AlertEvent = {
      event_id: `import-${String(existingCount + events.length + 1).padStart(6, "0")}`,
      timestamp,
      source: "syslog-import",
      alert_type: alertType,
      severity,
      device,
      interface: iface,
      metric: { name: metricName, value },
      message,
      syslog: line,
    };
    if (metricName === "ticket_id") {
      event.ticket_id = pyStr(value);
      event.ticket_action = message.toLowerCase().includes("opened") ? "created" : "updated";
    }
    events.push(event);
  }
  return { events, invalid };
}

/** The size error for alarm text, or null when it is within the limits. */
export function importLimitError(text: string): string | null {
  if (utf8Length(text) > MAX_IMPORT_BYTES) return "Alarm text is too large (maximum 1 MB).";
  const lines = pySplitlines(text);
  if (lines.length > MAX_IMPORT_LINES) return "Alarm text has too many lines (maximum 5000).";
  if (lines.some((line) => pyLen(line) > MAX_IMPORT_LINE_CHARS)) {
    return "A syslog line is too long (maximum 4096 characters).";
  }
  return null;
}

export type ImportResult =
  | { ok: true; imported: number; ignored: number; events: AlertEvent[] }
  | { ok: false; error: string };

/** The checks of POST /alerts/import, in the same order, without storing anything. */
export function importAlarmText(text: unknown, existingCount = 0): ImportResult {
  if (typeof text !== "string" || !pyStrip(text)) {
    return { ok: false, error: "paste syslog alarm lines or select a non-empty text file" };
  }
  const limit = importLimitError(text);
  if (limit) return { ok: false, error: limit };
  const { events, invalid } = parseSyslogText(text, existingCount);
  if (events.length === 0) {
    return { ok: false, error: "no supported syslog alarms found; expected simulator-style syslog lines" };
  }
  return { ok: true, imported: events.length, ignored: invalid, events };
}
