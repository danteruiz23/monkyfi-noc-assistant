/**
 * Port of backend/summarizer.py: the ticket-closure summary draft.
 * Built only from the correlated timeline, peak metrics and the runbook
 * suggestion. No AI call.
 */
import { affectedCustomers, peakPacketLoss, peakUtilization } from "./correlator";
import { pyFloatRepr, pySortedUnique, pyStr } from "./py";
import { suggestionText } from "./remediation";
import type { Incident, Suggestion } from "./types";

/** Return the ticket-closure summary text for one incident. */
export function draftSummary(incident: Incident, suggestions: readonly Suggestion[]): string {
  const customers = affectedCustomers(incident);
  const devices = pySortedUnique(incident.events.map((e) => e.device));
  const links = pySortedUnique(incident.events.map((e) => e.interface));
  const keyEvents: string[] = [];
  const seenTypes = new Set<string>();
  for (const e of incident.events) {
    // One representative line per alert type, in timeline order.
    if (!seenTypes.has(e.alert_type)) {
      keyEvents.push(`- ${e.timestamp} ${e.device} ${e.interface}: ${e.message}`);
      seenTypes.add(e.alert_type);
    }
  }
  const lines = [
    `Incident: ${incident.title}`,
    `Window: ${incident.start} -> ${incident.end} (${pyFloatRepr(incident.duration_minutes)} min)`,
    `Devices: ${devices.join(", ")}`,
    `Links: ${links.join(", ")}`,
    `Alerts correlated: ${incident.event_count}`,
    `Peak packet loss: ${pyStr(peakPacketLoss(incident))}%`,
    `Peak uplink utilization: ${pyStr(peakUtilization(incident))}%`,
    `Customers affected: ${customers.length ? customers.join(", ") : "none reported"}`,
    `Duplicate tickets merged: ${incident.ticket_ids.length ? incident.ticket_ids.join(", ") : "none"}`,
    "",
    "Key timeline:",
    ...keyEvents,
    "",
    "Remediation:",
    suggestionText(incident, suggestions),
  ];
  return lines.join("\n");
}
