/**
 * Server-side loader for the synthetic demo data in web/data/.
 * Uses parsePyJson so floats such as 12.0 keep their type (see lib/py.ts).
 */
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePyJson } from "./py";
import type { AlertEvent, Runbook } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function readData(name: string): string {
  return readFileSync(path.join(DATA_DIR, name), "utf-8");
}

export function loadAlerts(): AlertEvent[] {
  return parsePyJson<AlertEvent[]>(readData("alerts.json"));
}

export function loadRunbooks(): Runbook[] {
  return parsePyJson<Runbook[]>(readData("runbooks.json"));
}

export function loadSyslogDemo(): string {
  return readData("alarmas-demo.txt");
}

/**
 * The raw data text for the browser. It is parsed there with parsePyJson,
 * because plain JSON.parse would turn 12.0 into 12 and break the Python parity.
 */
export function loadRawData(): { alertsJson: string; runbooksJson: string; sampleSyslog: string } {
  return {
    alertsJson: readData("alerts.json"),
    runbooksJson: readData("runbooks.json"),
    sampleSyslog: loadSyslogDemo(),
  };
}
