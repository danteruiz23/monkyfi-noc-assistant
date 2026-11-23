/**
 * Port of voice_answer() in backend/app.py: deterministic answers to the
 * demo's NOC questions. No AI call and no API key.
 *
 * The question is data, never instructions. It is only matched against fixed
 * patterns, and every answer is built from the loaded events and runbooks.
 * Off-topic or manipulative questions get a fixed refusal.
 */
import { affectedCustomers, correlate, peakPacketLoss, peakUtilization } from "./correlator";
import { ignoreCaseInput, pyFloatRepr, pyFold, pyLen, pyRegex, pyStr, pyStrip } from "./py";
import { suggest, suggestionText } from "./remediation";
import type { AlertEvent, Runbook } from "./types";

export const MAX_QUESTION_CHARS = 500;

export const GENERIC_ANSWER =
  "I can answer: which links are saturated, the probable cause, " +
  "the impact, which tickets were merged, how long the incident lasted, " +
  "or which customers are affected.";
export const REFUSAL = "Sorry, I can only answer questions about the current NOC incident.";
export const TOO_LONG_ANSWER = "This question is too long (maximum 500 characters).";

const MALICIOUS = pyRegex(
  "(" +
    "\\b(passwords?|credentials?|credenciales|contrasenas?|secrets?)\\b|" +
    "\\bapi[-_ ]?keys?\\b|\\baccess tokens?\\b|\\bbearer\\b|" +
    "\\b(sabot\\w*|ddos|exploits?|malware|ransomware|hack(?:ing|er|ed)?)\\b|" +
    "\\b(evadir|evade|evasion|bypass)\\b|" +
    "\\bjailbreaks?\\b|" +
    "ignore (?:(?:all |any |previous |prior |above )*)(?:instructions|prompts)|" +
    "\\bsystem prompt\\b|" +
    "\\bhow (?:do i|to) (?:attack|hack|exploit)\\b|" +
    "\\b(?:shut ?down|take down|disable) (?:the )?(?:monitor\\w*|alarms?|logging|controls)\\b" +
    ")",
  "i",
);

const SCOPE = pyRegex(
  "(" +
    "\\b(noc|incidents?|incidentes?|alerts?|alarmas?|links?|enlaces?)\\b|" +
    "\\b(bgp|packets?|losses?|loss|uplinks?|devices?|dispositivos?)\\b|" +
    "\\b(runbooks?|remedi\\w*|customers?|clientes?|networks?|outages?)\\b|" +
    "\\b(flaps?|optics?|utiliz\\w*|summar(?:y|ies)|resumen\\w*)\\b|" +
    "\\b(satur\\w*|causes?|causas?|impacts?|impactos?|tickets?|fusion\\w*)\\b|" +
    "\\b(durations?|duracion\\w*|interfaces?|syslogs?|correlat\\w*)\\b|" +
    "\\b(routers?|switches?|latenc\\w*|mia-|dfw-)\\b|" +
    "how long|cuanto duro" +
    ")",
  "i",
);

const DURATION_TOKENS = ["duration", "duracion", "how long", "lasted", "cuanto duro"];

/**
 * Answer one question about the current incident (the earliest one).
 * `question` may be any JSON value; only a non-blank string is answered.
 */
export function answerQuestion(question: unknown, events: readonly AlertEvent[], runbooks: readonly Runbook[]): string {
  if (typeof question !== "string" || !pyStrip(question)) return GENERIC_ANSWER;
  if (pyLen(question) > MAX_QUESTION_CHARS) return TOO_LONG_ANSWER;
  const q = pyFold(question);
  const qMatch = ignoreCaseInput(q);
  if (MALICIOUS.test(qMatch)) return REFUSAL;
  const incidents = correlate(events);
  const main = incidents.length ? incidents[0] : null;

  if (q.includes("satur")) {
    if (!main) return "No saturation alerts right now.";
    return `Uplink Te0/0/0/0 on MIA-EDGE-02 peaked at ${pyStr(peakUtilization(main))}% utilization.`;
  }
  if (q.includes("causa") || q.includes("cause") || q.includes("probable")) {
    if (!main) return "No active incident to diagnose.";
    return suggestionText(main, suggest(main, runbooks));
  }
  if (q.includes("impact")) {
    if (!main) return "No active incident.";
    return (
      `${main.event_count} alerts correlated into one incident. ` +
      `Peak packet loss ${pyStr(peakPacketLoss(main))}%, ` +
      `${main.ticket_ids.length} duplicate tickets merged.`
    );
  }
  if (q.includes("ticket") || q.includes("fusion")) {
    if (!main) return "No active incident.";
    if (main.ticket_ids.length === 0) return "No duplicate tickets were merged for the current incident.";
    return `${main.ticket_ids.length} duplicate tickets merged: ${main.ticket_ids.join(", ")}.`;
  }
  if (DURATION_TOKENS.some((t) => q.includes(t))) {
    if (!main) return "No active incident.";
    return `The incident lasted ${pyFloatRepr(main.duration_minutes)} minutes, from ${main.start} to ${main.end}.`;
  }
  if (q.includes("customer") || q.includes("cliente")) {
    if (!main) return "No active incident.";
    const customers = affectedCustomers(main);
    if (customers.length === 0) return "No affected customers are identified on the current incident.";
    return `Affected customers: ${customers.join(", ")}.`;
  }
  if (SCOPE.test(qMatch)) return GENERIC_ANSWER;
  return REFUSAL;
}
