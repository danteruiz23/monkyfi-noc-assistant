/**
 * Port of backend/correlator.py: deterministic alert correlation.
 *
 * - Events on the MIA-* device cluster within one 30-minute window (measured
 *   from the incident's first event) merge into ONE incident; their tickets
 *   merge too.
 * - Events on any other device form incidents per device.
 *
 * Like the Python version, this is tied to the demo devices on purpose
 * (general correlation is SPEC phase 6).
 */
import { PyFloat, asciiDigits, isPyNumber, pyCompare, pyMax, pyRegex, pyRound, type PyNumber } from "./py";
import type { AlertEvent, Incident } from "./types";

export const WINDOW_MS = 30 * 60 * 1000;
export const MAIN_CLUSTER = new Set(["MIA-EDGE-02", "MIA-AGG-01", "MIA-CORE-01"]);

/** The regex Python's strptime builds for "%Y-%m-%dT%H:%M:%SZ" (IGNORECASE). */
const STRPTIME = pyRegex(
  "^(\\d\\d\\d\\d)-(1[0-2]|0[1-9]|[1-9])-(3[0-1]|[1-2]\\d|0[1-9]|[1-9]| [1-9])" +
    "T(2[0-3]|[0-1]\\d|\\d| \\d):([0-5]\\d|\\d):(6[0-1]|[0-5]\\d|\\d)Z$",
  "i",
);

export class TimestampError extends Error {
  constructor(readonly timestamp: string) {
    super(`time data ${JSON.stringify(timestamp)} does not match format '%Y-%m-%dT%H:%M:%SZ'`);
    this.name = "TimestampError";
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(2000 + (year % 400), month, 0)).getUTCDate();
}

/**
 * datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ") as milliseconds since the epoch.
 * Throws TimestampError wherever Python raises ValueError.
 */
export function parseTimestamp(ts: string): number {
  const m = STRPTIME.exec(ts);
  if (!m) throw new TimestampError(ts);
  const [year, month, day, hour, minute, second] = m.slice(1).map((g) => Number(asciiDigits(g.trim())));
  if (year < 1 || day > daysInMonth(year, month) || second > 59) throw new TimestampError(ts);
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, minute, second, 0);
  return d.getTime();
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    // Python's strftime("%Y") on Linux does not pad years below 1000.
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`
  );
}

interface Building {
  id: string;
  primary_device: string;
  primary_cluster: string;
  start: number;
  end: number;
  events: AlertEvent[];
  ticket_ids: string[];
}

/** Return the incidents for a list of events. Does not change the input. */
export function correlate(input: readonly AlertEvent[]): Incident[] {
  const events = [...input].sort((a, b) => pyCompare(a.timestamp, b.timestamp));
  const building: Building[] = [];

  for (const event of events) {
    const ts = parseTimestamp(event.timestamp);
    const inMain = MAIN_CLUSTER.has(event.device);
    let target = building.find((inc) => {
      const sameCluster = inMain ? inc.primary_cluster === "MIA" : inc.primary_cluster === event.device;
      return sameCluster && ts - inc.start <= WINDOW_MS;
    });
    if (!target) {
      target = {
        id: `INC-COPILOT-${String(building.length + 1).padStart(2, "0")}`,
        primary_device: event.device,
        primary_cluster: inMain ? "MIA" : event.device,
        start: ts,
        end: ts,
        events: [],
        ticket_ids: [],
      };
      building.push(target);
    }
    target.events.push(event);
    target.end = Math.max(target.end, ts);
    const ticket = event.ticket_id;
    if (ticket && !target.ticket_ids.includes(ticket)) target.ticket_ids.push(ticket);
  }

  return building.map((inc) => {
    const types = inc.events.map((e) => e.alert_type);
    let title: string;
    let probable_cause: string;
    if (types.includes("bgp_flap")) {
      title = `BGP flap on ${inc.primary_device} cascading to saturation and packet loss`;
      probable_cause = "BGP neighbor flap on MIA-EDGE-02 (neighbor 198.51.100.2)";
    } else if (types.includes("optical_degradation")) {
      title = `Optical degradation on ${inc.primary_device}`;
      probable_cause = "Degrading optic on DFW-CORE-01 Hu0/0/0/2";
    } else {
      title = `Incident on ${inc.primary_device}`;
      probable_cause = "Unknown — see timeline";
    }
    return {
      id: inc.id,
      title,
      primary_device: inc.primary_device,
      events: inc.events,
      ticket_ids: inc.ticket_ids,
      probable_cause,
      start: formatTimestamp(inc.start),
      end: formatTimestamp(inc.end),
      duration_minutes: pyRound((inc.end - inc.start) / 1000 / 60, 1),
      event_count: inc.events.length,
    };
  });
}

function peak(incident: Incident, alertType: string, empty: PyNumber): PyNumber {
  const values = incident.events
    .filter((e) => e.alert_type === alertType)
    .map((e) => e.metric.value)
    .filter(isPyNumber);
  return values.length ? pyMax(values) : empty;
}

/** Highest packet_loss value (0.0 when there is none). Print with pyStr(). */
export function peakPacketLoss(incident: Incident): PyNumber {
  return peak(incident, "packet_loss", new PyFloat(0));
}

/** Highest link_saturation value (0 when there is none). Print with pyStr(). */
export function peakUtilization(incident: Incident): PyNumber {
  return peak(incident, "link_saturation", 0);
}

/** The demo's fictional customers named in the incident's alert messages. */
export function affectedCustomers(incident: Incident): string[] {
  const customers = new Set<string>();
  for (const e of incident.events) {
    if (e.message.includes("ACME Corp")) customers.add("ACME Corp");
    if (e.message.includes("Globex")) customers.add("Globex");
  }
  return [...customers].sort(pyCompare);
}
