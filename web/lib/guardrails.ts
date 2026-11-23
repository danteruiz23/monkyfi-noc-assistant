/**
 * Monkyfi guardrails for the questions route (standard from the
 * monkyfi-guardrails skill, adapted to a deterministic agent with no AI).
 *
 * Layers:
 * 1. Classification before answering: every question is labelled on_topic,
 *    off_topic, about_agent or manipulation. Anything that is not on topic
 *    gets a FIXED text; no answer is built from the data.
 * 2. No model and no prompt in the public demo, so there is nothing to leak:
 *    answers are built only from the loaded events and runbooks (lib/answers.ts).
 * 3. Strike count and log: each off-topic or manipulation attempt adds one
 *    strike and writes a redacted log line; from the 3rd one the reply says it
 *    was reported, and the log line is a report (event "guardrail_report").
 * 4. Access and usage, outside the answer logic: request rate limit and size
 *    limits (see lib/server/ask.ts).
 *
 * Policy (Dante's decisions): off-topic -> "I can't answer that question" and
 * a sentence that brings the user back to the incident, without explaining or
 * listing rules. "What can you do?" says what the assistant does and is not a
 * strike. When in doubt, the message is on topic. Pasted alarm text is data:
 * it is never obeyed and never counts as a strike.
 *
 * Pure functions and small in-memory stores only (no I/O), so it is easy to test.
 */
import { answerParts, MAX_QUESTION_CHARS, type AnswerParts } from "./answers";
import { STRINGS, fmt, type Lang } from "./i18n";
import { answerText } from "./localize";
import { pyFold, pyLen, pyStrip } from "./py";
import type { AlertEvent, Runbook } from "./types";

export const MESSAGE_INTENTS = ["on_topic", "off_topic", "about_agent", "manipulation"] as const;
export type MessageIntent = (typeof MESSAGE_INTENTS)[number];

/** Attempt from which the reply says the attempt was reported (Dante's decision). */
export const GUARDRAIL_REPORT_AT = 3;

/** How a question is handled. */
export type AskMode =
  | "answer" // built from the incident data
  | "generic" // in scope, but not one of the six topics: says what it can answer
  | "about" // "what can you do?"
  | "human_control" // a command: the assistant recommends, the NOC decides
  | "pasted_data" // pasted alarm lines: data, never instructions
  | "too_long"
  | "blocked" // off topic or manipulation, attempts 1 and 2
  | "reported"; // off topic or manipulation, from the 3rd attempt

export interface Assessment {
  intent: MessageIntent;
  /** Short machine-readable reason, for tests and the log (never shown). */
  reason: string;
  /** The answer branch, when the question is answered from the data. */
  parts: AnswerParts | null;
  mode: Exclude<AskMode, "blocked" | "reported"> | "strike";
}

/* ------------------------------------------------------------ patterns */

// All patterns run on fold(question): compatibility forms folded (full-width
// letters), lower case, accents removed.

function fold(text: string): string {
  return pyFold(text.normalize("NFKC"));
}

/** Alarm lines pasted into the question box (simulator syslog). */
const PASTED_SYSLOG = /<\d{1,3}>\d{1,2} \d{4}-\d\d-\d\dt\d\d:\d\d:\d\dz \S+ [a-z]+-\d-[a-z]+:/;

const REVEAL_VERBS =
  "(?:reveal|show|print|display|repeat|list|tell me|give me|share|write|translate|summari[sz]e|copy|output|decode|" +
  "dime|dame|muestra\\w*|ensena\\w*|revela\\w*|repite|repetir|lista\\w*|enumera\\w*|escribe|traduce\\w*|resume|copia|" +
  "decodifica\\w*|lee\\w*|mostre|me mostre|mostrar|diga|repita)";
const INTERNAL_OBJECTS =
  "(?:instruc\\w*|prompt\\w*|rules|reglas|regras|guardrails?|restrictions|restricciones|normas|directives|directivas)";

const MANIPULATION = new RegExp(
  [
    // Ignore or change the rules (EN, ES, PT).
    "\\b(?:ignore|ignora\\w*|ignorar|olvida\\w*|forget|disregard|desconsidera\\w*|esquece\\w*|override|salta\\w*|skip)\\b.{0,40}" +
      "\\b(?:instruc\\w*|rules|reglas|regras|prompt\\w*|indicaciones|normas|restric\\w*|guidelines|directrices|filtros?|filters?)",
    // The system prompt, in any language.
    "system ?prompt|prompt del sistema|prompt do sistema|system message|mensaje del sistema|developer message|" +
      "mensaje de desarrollador|initial prompt|prompt inicial|hidden prompt|prompt oculto",
    "\\b(?:internal|hidden|secret|internas|ocultas|secretas|internos)\\s+(?:instruc\\w*|rules|reglas|prompt\\w*|guidelines)",
    "\\b(?:instrucciones|reglas|instrucoes|regras) (?:internas|ocultas|secretas|internos)",
    "\\b(?:textualmente|word for word|verbatim|palabra por palabra|literalmente)\\b",
    // Text before the conversation.
    "repeat (?:everything|all|the text|what) .{0,30}(?:above|before)|repite todo|texto que aparece antes|" +
      "text (?:above|before) (?:my|the)|antes de mi primer mensaje|before my first message|empezando por \"?eres|starting with \"?you are",
    // Role play and other personas.
    "\\b(?:act as|actua como|actue como|pretend (?:to be|you are)|finge (?:ser|que)|roleplay|role play|juego de rol|" +
      "you are now|ahora eres|a partir de ahora eres|from now on you are|imagine you are|imagina que eres|haz de cuenta)\\b",
    "\\b(?:jailbreak|developer mode|modo desarrollador|dan mode|modo dan|do anything now|god mode|modo dios)\\b",
    "\\b(?:sin|without|no|sem)\\s+(?:restricciones|restrictions|filtros|filters|limites|limits|reglas|rules|censura|censorship|restricoes)\\b",
    // Fake identity or authorization.
    "\\b(?:soy|i am|i'm|im|sou)\\s+(?:el |la |the |an? |o |a )?(?:administrador\\w*|admin\\w*|desarrollador\\w*|developer|" +
      "creador|creator|dueno|owner|root|superuser|ceo|cto|director)\\b",
    "\\b(?:tengo|i have|tenho)\\s+(?:autorizacion|authorization|permiso|permission|acceso total|full access|autorizacao)\\b",
    "\\b(?:ya te autorice|te autorizo|i authorize you|i already authorized|you are authorized|estas autorizado)\\b",
  ].join("|"),
  "i",
);

/**
 * Show, repeat or translate the assistant's own instructions or rules. Not
 * applied when the question is about a runbook, whose steps are instructions too.
 */
const REVEAL_INTERNAL = new RegExp(
  `\\b${REVEAL_VERBS}\\b.{0,60}\\b(?:your|tus|tu|sus|suas|seu|all|todas?|todos|internal|internas)\\b.{0,30}\\b${INTERNAL_OBJECTS}`,
  "i",
);
const RUNBOOK_TOPIC = /\b(?:runbooks?|playbooks?|remedia\w*|fix|correccion|rb-\d+)\b/i;

/** "What can you do?" and similar: answered with what the assistant does; never a strike. */
const ABOUT_AGENT = new RegExp(
  [
    "\\bwhat (?:can|do) you (?:do|answer)\\b|\\bwho are you\\b|\\bwhat are you\\b|\\bhow do you work\\b|\\bwhat is this\\b",
    "\\byour (?:rules|limits|limitations|restrictions|guardrails|capabilities|scope)\\b",
    "\\bque (?:puedes|sabes) (?:hacer|responder)\\b|\\bque haces\\b|\\bquien eres\\b|\\bque eres\\b|\\bcomo funcionas\\b",
    "\\btus (?:reglas|limites|limitaciones|restricciones|capacidades)\\b",
    "^\\s*(?:help|ayuda|hola|hello|hi|hey|buenas|buenos dias|good morning)\\s*[!?.]*\\s*$",
  ].join("|"),
  "i",
);

/** Privacy: other people's or companies' data. Off topic even when mixed with incident words. */
const PRIVACY = new RegExp(
  [
    "\\b(?:other|otros|otras|outros|outras)\\s+(?:users?|usuarios?|companies|empresas|clients?|clientes|customers?|people|personas|operators?|operadores)\\b",
    "\\b(?:personal|personales|pessoais)\\s+(?:data|info\\w*)\\b|\\bdatos personales\\b|\\bdados pessoais\\b",
    "\\b(?:confidential|confidencial\\w*|private|privad[oa]s?)\\s+(?:data|info\\w*|datos|details|detalles)\\b",
    "\\b(?:phone|telephone|telefono|email|e-mail|correo|address|direccion|celular)\\s+(?:number\\s+)?(?:of|de|del|da|do)\\b",
    "\\b(?:home address|contact details|datos de contacto)\\b",
  ].join("|"),
  "i",
);

/** Money and purchases: the assistant never moves money or approves purchases. */
const MONEY =
  /\b(?:transfer\w*|transfiere\w*|transferir|wire|iban|swift|payments?|pagos?|pagar|pague|purchases?|compras?|comprar|credit card|tarjeta de credito|bank account|cuenta bancaria|refund|reembols\w*|invoice|factura\w*)\b/i;

/** Harmful or abusive requests not already covered by the parity patterns in lib/answers.ts. */
const HARMFUL =
  /\b(?:explosiv\w*|bombs?|bombas?|weapons?|armas?|steal\w*|robar|roba|phishing|keylogger|insult\w*|humill\w*|humiliat\w*|discrimin\w*|racist\w*|racista\w*|porque es mujer|because (?:she|he) is)\b/i;

/**
 * Network words outside the six demo topics. A question with them is in the
 * NOC's domain: it gets the "what I can answer" text, never a strike
 * (when in doubt, the message is on topic).
 */
const NETWORK_DOMAIN =
  /\b(?:osnr|dwdm|mpls|ospf|is-?is|isis|vlan|vrf|lsp|qos|sla|mttr|mtbf|noc|nms|snmp|netflow|jitter|throughput|bandwidth|ancho de banda|fib(?:er|re|ra)s?|optic\w*|optica\w*|transceiver|sfp|amplifier|amplificador\w*|backbone|peering|prefix\w*|prefijos?|asn|traceroute|ping|uptime|downtime|caida|redundan\w*|failover|telecom\w*|carrier|isp|data ?center|submarin\w*|cable)\b/i;

/** A command: the assistant does not execute actions; it recommends (human control). */
const COMMAND = new RegExp(
  "^(?:(?:please|pls|por favor|can you|could you|would you|puedes|podrias|pueden|quiero que|i want you to|go ahead and|now|ahora)[\\s,]+)*" +
    "(?:reboot|restart|reload|reinicia\\w*|apaga\\w*|shut\\w*|close|cierra\\w*|cerrar|roll ?back|rollback|revert\\w*|revierte|deshaz|" +
    "apply|aplica\\w*|execute|ejecuta\\w*|run|corre|disable|deshabilita\\w*|desactiva\\w*|enable|habilita\\w*|activa\\w*|delete|remove|" +
    "borra\\w*|elimina\\w*|merge|fusiona\\w*|open|abre|abrir|escalate|escala\\w*|change|cambia\\w*|configure|configura\\w*|push|deploy|" +
    "despliega\\w*|reset|resetea\\w*|clear|limpia\\w*|block|bloquea\\w*|send|envia\\w*|enviar|notify|notifica\\w*|llama\\w*|update(?! me)|" +
    "actualiza\\w*|fix|arregla\\w*|repara\\w*|isolate|aisla\\w*|reroute|redirige\\w*|shift|mueve|replace|reemplaza\\w*|reseat|" +
    "reinserta\\w*|failover|bounce|kill|mata|deten\\w*|approve|aprueba\\w*|authori[sz]e|autoriza\\w*)\\b",
  "i",
);

/** Letters written one by one ("s h o w  m e  y o u r  p r o m p t"). */
const SPACED_LETTERS = /(?:^|\s)(?:\p{L}\s+){5,}\p{L}(?:\s|$)/u;

/** Possible base64 payloads. */
const BASE64_TOKENS = /[A-Za-z0-9+/]{16,}={0,2}/g;
const BASE64_TOKEN = /[A-Za-z0-9+/]{16,}={0,2}/;

function decodeBase64(token: string): string | null {
  try {
    const text = atob(token.length % 4 ? token + "=".repeat(4 - (token.length % 4)) : token);
    // Only printable text counts as a hidden message.
    return /^[\x20-\x7e\t\r\n\u00a0-\u00ff]+$/.test(text) && /[a-z]{3,}/i.test(text) ? text : null;
  } catch {
    return null;
  }
}

/** True when the question tries to change, reveal or bypass the assistant's instructions. */
export function isManipulation(question: string): boolean {
  const q = fold(question);
  if (MANIPULATION.test(q)) return true;
  if (REVEAL_INTERNAL.test(q) && !RUNBOOK_TOPIC.test(q)) return true;
  // Obfuscation: letters written one by one.
  if (SPACED_LETTERS.test(q)) {
    const joined = q.replace(/\s+/g, "");
    if (/systemprompt|promptdelsistema|promptdosistema|instruc|reglasinternas|internalrules|ignor|olvida|forget|muestrame|showme|reveal|revela/.test(joined)) {
      return true;
    }
  }
  // Obfuscation: an order hidden in base64.
  for (const token of question.match(BASE64_TOKENS) ?? []) {
    const decoded = decodeBase64(token);
    if (decoded && (MANIPULATION.test(fold(decoded)) || /\b(?:prompt|instruc\w*|rules|reglas)\b/i.test(decoded))) return true;
  }
  return /\b(?:decode|decodifica\w*|decodifique|descifra\w*)\b/.test(q) && BASE64_TOKEN.test(question);
}

/* --------------------------------------------------------- classification */

/**
 * Classify one question and decide how it is handled. Nothing here follows
 * the question: it is only matched against fixed patterns.
 */
export function assessQuestion(question: unknown, events: readonly AlertEvent[], runbooks: readonly Runbook[]): Assessment {
  if (typeof question !== "string" || !pyStrip(question)) {
    return { intent: "on_topic", reason: "empty", parts: { kind: "generic" }, mode: "generic" };
  }
  if (pyLen(question) > MAX_QUESTION_CHARS) {
    return { intent: "on_topic", reason: "too_long", parts: { kind: "too_long" }, mode: "too_long" };
  }
  const q = fold(question);

  // Pasted alarm lines are data: never obeyed, never a strike.
  if (PASTED_SYSLOG.test(q)) return { intent: "on_topic", reason: "pasted_syslog", parts: null, mode: "pasted_data" };

  if (isManipulation(question)) return { intent: "manipulation", reason: "manipulation", parts: null, mode: "strike" };
  if (PRIVACY.test(q)) return { intent: "off_topic", reason: "privacy", parts: null, mode: "strike" };
  if (MONEY.test(q)) return { intent: "off_topic", reason: "money", parts: null, mode: "strike" };
  if (HARMFUL.test(q)) return { intent: "off_topic", reason: "harmful", parts: null, mode: "strike" };

  const parts = answerParts(question, events, runbooks);
  if (parts.kind === "refusal") {
    if (parts.reason === "out_of_scope" && ABOUT_AGENT.test(q)) {
      return { intent: "about_agent", reason: "about_agent", parts: null, mode: "about" };
    }
    if (parts.reason === "out_of_scope" && NETWORK_DOMAIN.test(q) && !COMMAND.test(q.replace(/^[\s¿¡"'(]+/, ""))) {
      return { intent: "on_topic", reason: "network_domain", parts: { kind: "generic" }, mode: "generic" };
    }
    // The parity patterns flag credentials, attacks and disabling the monitoring.
    return {
      intent: parts.reason === "malicious" ? "manipulation" : "off_topic",
      reason: parts.reason,
      parts,
      mode: "strike",
    };
  }
  if (COMMAND.test(q.replace(/^[\s¿¡"'(]+/, ""))) return { intent: "on_topic", reason: "command", parts: null, mode: "human_control" };
  if (parts.kind === "generic") {
    if (ABOUT_AGENT.test(q)) return { intent: "about_agent", reason: "about_agent", parts: null, mode: "about" };
    return { intent: "on_topic", reason: "generic", parts, mode: "generic" };
  }
  return { intent: "on_topic", reason: parts.kind, parts, mode: "answer" };
}

/** Does this intent count as an attempt? "What can you do?" does not. */
export function countsAsStrike(intent: MessageIntent): boolean {
  return intent === "off_topic" || intent === "manipulation";
}

/** The final mode once the attempt number is known. */
export function finalMode(assessment: Assessment, attempt: number): AskMode {
  if (assessment.mode !== "strike") return assessment.mode;
  return attempt >= GUARDRAIL_REPORT_AT ? "reported" : "blocked";
}

/**
 * The reply text. Fixed texts never explain or list rules; data answers come
 * from lib/localize.ts (English is the parity-tested text).
 */
export function replyText(assessment: Assessment, lang: Lang, attempt: number): string {
  const t = STRINGS[lang];
  switch (finalMode(assessment, attempt)) {
    case "answer":
    case "generic":
      return answerText(assessment.parts ?? { kind: "generic" }, lang);
    case "too_long":
      return t.askTooLong;
    case "about":
      return `${t.askAbout} ${t.askResume}`;
    case "human_control":
      return t.askHumanControl;
    case "pasted_data":
      return t.askPasted;
    case "blocked":
      return `${t.askRefusal} ${t.askResume}`;
    case "reported":
      return `${fmt(t.askReported, { n: attempt })} ${t.askResume}`;
  }
}

/* ------------------------------------------------------- strikes and log */

/**
 * Strike count per client, kept on the server so clearing the chat in the
 * browser does not reset it. In memory: on serverless hosting each instance
 * keeps its own count, so this is a best-effort count for a public demo.
 */
export class StrikeCounter {
  private readonly strikes = new Map<string, { count: number; last: number }>();

  constructor(
    private readonly ttlMs = 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 10_000,
  ) {}

  /** Strikes so far for this client (0 after the TTL without new strikes). */
  current(key: string): number {
    const entry = this.strikes.get(key);
    if (!entry) return 0;
    if (this.now() - entry.last > this.ttlMs) {
      this.strikes.delete(key);
      return 0;
    }
    return entry.count;
  }

  /** Add one strike and return the attempt number. */
  add(key: string): number {
    const count = this.current(key) + 1;
    this.strikes.delete(key);
    this.strikes.set(key, { count, last: this.now() });
    while (this.strikes.size > this.maxKeys) {
      const oldest = this.strikes.keys().next().value;
      if (oldest === undefined) break;
      this.strikes.delete(oldest);
    }
    return count;
  }
}

/** Sliding-window request limit per client (in memory, best effort per instance). */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 10_000,
  ) {}

  /** Count one request; returns whether it is allowed and, if not, seconds to wait. */
  hit(key: string): { ok: boolean; retryAfter: number } {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000)) };
    }
    recent.push(now);
    this.hits.delete(key);
    this.hits.set(key, recent);
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
    return { ok: true, retryAfter: 0 };
  }
}

/**
 * Remove e-mails, keys, account numbers and phone-like numbers before a
 * message excerpt is written to the log.
 */
export function redactSensitive(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(
      /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{12,}\b|\bAIza[0-9A-Za-z_-]{20,}\b|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\b[A-Za-z0-9]{32,}\b/g,
      "[key]",
    )
    .replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}\b/g, "[account]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[number]");
}

/** Log line for Monkyfi's internal team: attempts 1-2 = blocked; from the 3rd = report. */
export function guardrailLogEntry(options: {
  intent: MessageIntent;
  reason: string;
  attempt: number;
  lang: Lang;
  message: string;
  client: string;
  at?: Date;
}) {
  const { intent, reason, attempt, lang, message, client, at = new Date() } = options;
  return {
    event: attempt >= GUARDRAIL_REPORT_AT ? "guardrail_report" : "guardrail_blocked",
    agent: "monkyfi-noc-assistant",
    intent,
    reason,
    attempt,
    lang,
    client,
    // Only the start of the message, redacted: enough to review the attempt.
    excerpt: redactSensitive(message.replace(/\s+/g, " ").trim()).slice(0, 200),
    at: at.toISOString(),
  };
}
