/**
 * UI-side views of the ported logic, in English or Spanish.
 *
 * English always comes straight from the parity-tested logic (for example the
 * English closure summary IS draftSummary()). Spanish is built from the same
 * values, so both languages show the same facts. Nothing here calls an AI.
 */
import { affectedCustomers, peakPacketLoss, peakUtilization } from "./correlator";
import { logicText, type Lang, type StringKey } from "./i18n";
import { pyCompare, pyFloatRepr, pySortedUnique, pyStr } from "./py";
import { draftSummary } from "./summarizer";
import { suggestionText } from "./remediation";
import { answerTextEn, type AnswerParts } from "./answers";
import type { AlertEvent, Incident, Suggestion } from "./types";

/* ---------------------------------------------------------------- labels */

const TYPE_KEYS: Record<string, StringKey> = {
  bgp_flap: "typeBgpFlap",
  link_saturation: "typeLinkSaturation",
  packet_loss: "typePacketLoss",
  optical_degradation: "typeOptical",
  ticket_created: "typeTicketCreated",
  ticket_updated: "typeTicketUpdated",
  ticket: "typeTicket",
};

/** The i18n key for an alarm type, or null for a type the demo does not know. */
export function alertTypeKey(type: string): StringKey | null {
  return TYPE_KEYS[type] ?? null;
}

const SEVERITY_KEYS: Record<string, StringKey> = {
  critical: "sevCritical",
  major: "sevMajor",
  minor: "sevMinor",
};
const SEVERITY_RANK: Record<string, number> = { critical: 3, major: 2, minor: 1 };

export function severityKey(severity: string): StringKey | null {
  return SEVERITY_KEYS[severity] ?? null;
}

/** The highest severity among the incident's alarms. */
export function incidentSeverity(incident: Incident): string {
  let best = "";
  for (const e of incident.events) {
    if ((SEVERITY_RANK[e.severity] ?? 0) > (SEVERITY_RANK[best] ?? 0)) best = e.severity;
  }
  return best || (incident.events[0]?.severity ?? "");
}

/** "2026-11-04T02:00:30Z" -> "02:00:30" (the demo shows network time in UTC). */
export function clock(ts: string): string {
  const m = /T(\d\d:\d\d:\d\d)Z$/.exec(ts);
  return m ? m[1] : ts;
}

/** "2026-11-04T02:00:30Z" -> "2026-11-04 02:00:30". */
export function dateTime(ts: string): string {
  return ts.replace("T", " ").replace(/Z$/, "");
}

export function incidentDevices(incident: Incident): string[] {
  return pySortedUnique(incident.events.map((e) => e.device));
}

/* ------------------------------------------------- alarm messages and titles */

type Rule = [RegExp, (...groups: string[]) => string];

/** Spanish wording for the alarm messages of the simulator and the sample import file. */
const MESSAGE_ES: Rule[] = [
  [
    /^BGP neighbor (\S+) \(AS (\d+)\) state changed to (\w+) on (\S+) \(flap (\d+)\/(\d+)\)$/,
    (n, as, st, d, a, b) => `El vecino BGP ${n} (AS ${as}) cambió al estado ${st} en ${d} (flap ${a}/${b})`,
  ],
  [/^BGP neighbor (\S+) state changed to (\w+)$/, (n, st) => `El vecino BGP ${n} cambió al estado ${st}`],
  [
    /^BGP hold timer expired for neighbor (\S+) on (\S+)$/,
    (n, d) => `Venció el temporizador hold de BGP del vecino ${n} en ${d}`,
  ],
  [
    /^BGP neighbor (\S+) advertising (\d+) prefixes \(was (\d+)\)$/,
    (n, now, was) => `El vecino BGP ${n} anuncia ${now} prefijos (antes ${was})`,
  ],
  [
    /^BGP neighbor (\S+) stable, (\d+) flaps in last (\d+) minutes$/,
    (n, f, m) => `Vecino BGP ${n} estable, ${f} flaps en los últimos ${m} minutos`,
  ],
  [
    /^Uplink (\S+) utilization at (\d+)% \(threshold (\d+)%\) on (\S+)$/,
    (i, p, th, d) => `Utilización del uplink ${i} en ${p}% (umbral ${th}%) en ${d}`,
  ],
  [
    /^Uplink (\S+) utilization normalized to (\d+)% on (\S+)$/,
    (i, p, d) => `La utilización del uplink ${i} se normalizó en ${p}% en ${d}`,
  ],
  [/^Uplink utilization reached (\d+) percent$/, (p) => `La utilización del uplink llegó al ${p} por ciento`],
  [
    /^Auto-update: utilization still above (\d+)%$/,
    (p) => `Actualización automática: la utilización sigue por encima de ${p}%`,
  ],
  [
    /^Packet loss ([\d.]+)% on (\S+) (\S+) towards customer edge$/,
    (p, d, i) => `Pérdida de paquetes de ${p}% en ${d} ${i} hacia el borde del cliente`,
  ],
  [
    /^Packet loss ([\d.]+)% on (\S+) (\S+) \(secondary path, load-shared\)$/,
    (p, d, i) => `Pérdida de paquetes de ${p}% en ${d} ${i} (ruta secundaria, carga compartida)`,
  ],
  [
    /^Packet loss ([\d.]+)% on (\S+) (\S+); (\d+) enterprise customers affected \((.+)\)$/,
    (p, d, i, n, c) => `Pérdida de paquetes de ${p}% en ${d} ${i}; ${n} clientes empresariales afectados (${c})`,
  ],
  [
    /^Packet loss recovered to ([\d.]+)% on (\S+) (\S+)$/,
    (p, d, i) => `La pérdida de paquetes bajó a ${p}% en ${d} ${i}`,
  ],
  [/^Packet loss reached (\d+) percent$/, (p) => `La pérdida de paquetes llegó al ${p} por ciento`],
  [
    /^Optical Rx power (\S+) dBm on (\S+) (\S+) \(threshold (\S+) dBm\)$/,
    (p, d, i, th) => `Potencia óptica Rx de ${p} dBm en ${d} ${i} (umbral ${th} dBm)`,
  ],
  [
    /^NOC engineer opened ticket for BGP flap on (\S+)$/,
    (d) => `Un ingeniero del NOC abrió un ticket por el flap de BGP en ${d}`,
  ],
  [
    /^NOC engineer opened ticket for BGP instability$/,
    () => "Un ingeniero del NOC abrió un ticket por inestabilidad de BGP",
  ],
  [
    /^Monitoring tool auto-opened ticket for uplink saturation on (\S+)$/,
    (d) => `La herramienta de monitoreo abrió sola un ticket por saturación del uplink en ${d}`,
  ],
  [
    /^Customer (.+) reported packet loss, ticket opened$/,
    (c) => `El cliente ${c} reportó pérdida de paquetes; se abrió un ticket`,
  ],
  [
    /^Customer confirms impact on (\d+) enterprise circuits$/,
    (n) => `El cliente confirma impacto en ${n} circuitos empresariales`,
  ],
  [
    /^Engineer notes: loss correlates with BGP flap window$/,
    () => "Nota del ingeniero: la pérdida coincide con la ventana del flap de BGP",
  ],
  [
    /^Incident monitoring: all customer metrics green for (\d+) minutes$/,
    (n) => `Monitoreo del incidente: todas las métricas de clientes en verde durante ${n} minutos`,
  ],
  [/^Incident ready for closure summary$/, () => "Incidente listo para el resumen de cierre"],
  [
    /^Ticket opened for optical degradation on (\S+)$/,
    (d) => `Ticket abierto por degradación óptica en ${d}`,
  ],
];

function applyRules(rules: Rule[], text: string): string | null {
  for (const [pattern, build] of rules) {
    const m = pattern.exec(text);
    if (m) return build(...m.slice(1));
  }
  return null;
}

/**
 * An alarm message in the chosen language. Messages the demo does not know
 * (for example imported lines) are device data and are shown as they came.
 */
export function alarmMessage(message: string, lang: Lang): string {
  if (lang === "en") return message;
  return applyRules(MESSAGE_ES, message) ?? message;
}

/** True when the Spanish table covers this alarm message. */
export function hasSpanishMessage(message: string): boolean {
  return applyRules(MESSAGE_ES, message) !== null;
}

const TITLE_ES: Rule[] = [
  [
    /^BGP flap on (\S+) cascading to saturation and packet loss$/,
    (d) => `Flap de BGP en ${d} que deriva en saturación y pérdida de paquetes`,
  ],
  [/^Optical degradation on (\S+)$/, (d) => `Degradación óptica en ${d}`],
  [/^Incident on (\S+)$/, (d) => `Incidente en ${d}`],
];

/** The incident title (built by correlate()) in the chosen language. */
export function incidentTitle(incident: Incident, lang: Lang): string {
  if (lang === "en") return incident.title;
  return applyRules(TITLE_ES, incident.title) ?? incident.title;
}

/* ------------------------------------------------------------ causal chain */

export interface ChainStep {
  alert_type: string;
  timestamp: string;
  device: string;
  interface: string;
  /** Peak value for saturation (%) and packet loss (%), printed like Python. */
  peak?: string;
}

const CHAIN_ORDER = ["bgp_flap", "optical_degradation", "link_saturation", "packet_loss"];

/**
 * The causal chain shown on the detail screen: the first alarm of each
 * network alarm type, in time order (BGP flap -> saturation -> packet loss).
 */
export function causalChain(incident: Incident): ChainStep[] {
  const first = new Map<string, AlertEvent>();
  for (const e of incident.events) {
    if (CHAIN_ORDER.includes(e.alert_type) && !first.has(e.alert_type)) first.set(e.alert_type, e);
  }
  const steps = [...first.values()].sort((a, b) => pyCompare(a.timestamp, b.timestamp));
  return steps.map((e) => {
    const step: ChainStep = {
      alert_type: e.alert_type,
      timestamp: e.timestamp,
      device: e.device,
      interface: e.interface,
    };
    if (e.alert_type === "link_saturation") step.peak = pyStr(peakUtilization(incident));
    if (e.alert_type === "packet_loss") step.peak = pyStr(peakPacketLoss(incident));
    return step;
  });
}

/* ------------------------------------------------- remediation and summary */

/** suggestionText() in the chosen language (English is the parity-tested text). */
export function remediationText(incident: Incident, suggestions: readonly Suggestion[], lang: Lang): string {
  if (lang === "en") return suggestionText(incident, suggestions);
  if (suggestions.length === 0) {
    return "Ningún runbook histórico coincide con este incidente. Siguiente paso más seguro: aislar el enlace afectado y recolectar los contadores de la interfaz.";
  }
  const top = suggestions[0];
  return (
    `Causa probable: ${logicText(incident.probable_cause, lang)}. ` +
    `Acción recomendada (runbook ${top.runbook_id}): ${logicText(top.recommended_action, lang)} ` +
    `MTTR histórico de esta corrección: ${pyStr(top.mttr_before_min)} min -> ${pyStr(top.mttr_after_min)} min con el playbook del asistente.`
  );
}

/**
 * The closure summary draft. English is exactly draftSummary() (same as the
 * Python backend); Spanish has the same lines and values, translated.
 */
export function closureSummary(incident: Incident, suggestions: readonly Suggestion[], lang: Lang): string {
  if (lang === "en") return draftSummary(incident, suggestions);
  const customers = affectedCustomers(incident);
  const devices = incidentDevices(incident);
  const links = pySortedUnique(incident.events.map((e) => e.interface));
  const keyEvents: string[] = [];
  const seen = new Set<string>();
  for (const e of incident.events) {
    if (!seen.has(e.alert_type)) {
      keyEvents.push(`- ${e.timestamp} ${e.device} ${e.interface}: ${alarmMessage(e.message, lang)}`);
      seen.add(e.alert_type);
    }
  }
  return [
    `Incidente: ${incidentTitle(incident, lang)}`,
    `Ventana: ${incident.start} -> ${incident.end} (${pyFloatRepr(incident.duration_minutes)} min)`,
    `Equipos: ${devices.join(", ")}`,
    `Enlaces: ${links.join(", ")}`,
    `Alarmas correlacionadas: ${incident.event_count}`,
    `Pérdida de paquetes máxima: ${pyStr(peakPacketLoss(incident))}%`,
    `Utilización máxima del uplink: ${pyStr(peakUtilization(incident))}%`,
    `Clientes afectados: ${customers.length ? customers.join(", ") : "ninguno reportado"}`,
    `Tickets duplicados fusionados: ${incident.ticket_ids.length ? incident.ticket_ids.join(", ") : "ninguno"}`,
    "",
    "Línea de tiempo clave:",
    ...keyEvents,
    "",
    "Remediación:",
    remediationText(incident, suggestions, lang),
  ].join("\n");
}

/** Percent of repair time saved by the runbook (rounded to a whole number). */
export function mttrSaving(before: number, after: number): number {
  if (!(before > 0)) return 0;
  return Math.round(((before - after) / before) * 100);
}

/* --------------------------------------------------------------- answers */

const GENERIC_ES =
  "Puedo responder: qué enlaces están saturados, la causa probable, el impacto, " +
  "qué tickets se fusionaron, cuánto duró el incidente o qué clientes están afectados.";

/**
 * The answer to a question in the chosen language. English is answerTextEn()
 * (the Python backend's exact text); Spanish states the same facts.
 */
export function answerText(parts: AnswerParts, lang: Lang): string {
  if (lang === "en") return answerTextEn(parts);
  if (parts.kind === "generic") return GENERIC_ES;
  if (parts.kind === "too_long") return "Esta pregunta es demasiado larga (máximo 500 caracteres).";
  if (parts.kind === "refusal") return "Lo siento, solo puedo responder preguntas sobre el incidente actual del NOC.";
  const main = parts.incident;
  switch (parts.kind) {
    case "saturation":
      if (!main) return "No hay alertas de saturación en este momento.";
      return `El uplink Te0/0/0/0 de MIA-EDGE-02 llegó a un máximo de ${pyStr(peakUtilization(main))}% de utilización.`;
    case "cause":
      if (!main) return "No hay un incidente activo para diagnosticar.";
      return remediationText(main, parts.suggestions, lang);
    case "impact":
      if (!main) return "No hay un incidente activo.";
      return (
        `${main.event_count} alertas se correlacionaron en un solo incidente. ` +
        `Pérdida máxima de paquetes ${pyStr(peakPacketLoss(main))}%, ` +
        `${main.ticket_ids.length} tickets duplicados fusionados.`
      );
    case "tickets":
      if (!main) return "No hay un incidente activo.";
      if (main.ticket_ids.length === 0) return "No se fusionaron tickets duplicados en el incidente actual.";
      return `${main.ticket_ids.length} tickets duplicados fusionados: ${main.ticket_ids.join(", ")}.`;
    case "duration":
      if (!main) return "No hay un incidente activo.";
      return `El incidente duró ${pyFloatRepr(main.duration_minutes)} minutos, de ${main.start} a ${main.end}.`;
    case "customers": {
      if (!main) return "No hay un incidente activo.";
      const customers = affectedCustomers(main);
      if (customers.length === 0) return "No hay clientes afectados identificados en el incidente actual.";
      return `Clientes afectados: ${customers.join(", ")}.`;
    }
  }
}
