/**
 * Shared helpers for the parity tests. Fixtures come from
 * scripts/generate_fixtures.py, which runs the real Python backend.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  affectedCustomers,
  correlate,
  draftSummary,
  peakPacketLoss,
  peakUtilization,
  suggest,
  suggestionText,
  type AlertEvent,
  type Runbook,
} from "@/lib";
import { PyFloat, parsePyJson, pyFloatRepr } from "@/lib/py";

export const WEB = path.resolve(import.meta.dirname, "..");

export function fixture<T = any>(name: string): T {
  return JSON.parse(readFileSync(path.join(WEB, "test", "fixtures", name), "utf-8")) as T;
}

export function dataText(name: string): string {
  return readFileSync(path.join(WEB, "data", name), "utf-8");
}

export const alerts = (): AlertEvent[] => parsePyJson<AlertEvent[]>(dataText("alerts.json"));
export const runbooks = (): Runbook[] => parsePyJson<Runbook[]>(dataText("runbooks.json"));

/** Fields that are always Python floats, even when the value is whole (8.0). */
const FLOAT_KEYS = new Set(["duration_minutes"]);
const SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Tag TypeScript output the same way the Python generator tags its output:
 * floats become {"$float": repr}, ints beyond 2^53 become {"$int": str}.
 */
export function tag(value: unknown, key = ""): unknown {
  if (value instanceof PyFloat) return { $float: pyFloatRepr(value.value) };
  if (typeof value === "bigint") {
    return value > SAFE || value < -SAFE ? { $int: value.toString() } : Number(value);
  }
  if (typeof value === "number") {
    if (FLOAT_KEYS.has(key) || !Number.isInteger(value)) return { $float: pyFloatRepr(value) };
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => tag(v));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = tag(v, k);
    return out;
  }
  return value;
}

/** TypeScript twin of incident_bundle() in generate_fixtures.py. */
export function incidentBundle(events: readonly AlertEvent[], rbs: readonly Runbook[], compact = false) {
  let incidents;
  try {
    incidents = correlate(events);
  } catch (err) {
    return { error: "ValueError", message: (err as Error).message };
  }
  return {
    incidents: incidents.map((inc) => {
      const top2 = suggest(inc, rbs);
      return {
        incident: compact ? { ...inc, events: inc.events.map((e) => e.event_id) } : inc,
        suggestions: top2,
        ranking: compact ? null : suggest(inc, rbs, rbs.length),
        suggestion_text: suggestionText(inc, top2),
        summary: draftSummary(inc, top2),
        peak_packet_loss: peakPacketLoss(inc),
        peak_utilization: peakUtilization(inc),
        affected_customers: affectedCustomers(inc),
      };
    }),
  };
}

/** Compare a TS bundle with a Python bundle (error messages may differ). */
export function comparableBundle(bundle: any): unknown {
  if (bundle && "error" in bundle) return { error: bundle.error };
  return tag(bundle);
}

/** Rebuild an IEEE-754 double from the 16 hex digits Python wrote. */
export function fromBits(hex: string): number {
  const view = new DataView(new ArrayBuffer(8));
  for (let i = 0; i < 8; i++) view.setUint8(i, parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  return view.getFloat64(0);
}
