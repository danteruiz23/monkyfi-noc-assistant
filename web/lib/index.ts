/**
 * Deterministic NOC logic ported from the Python backend (backend/*.py).
 * Safe to use in the browser and on the server: no I/O, no AI, no keys.
 */
export * from "./types";
export { PyFloat, parsePyJson, pyFloatRepr, pyStr } from "./py";
export {
  MAIN_CLUSTER,
  TimestampError,
  WINDOW_MS,
  affectedCustomers,
  correlate,
  parseTimestamp,
  peakPacketLoss,
  peakUtilization,
} from "./correlator";
export { suggest, suggestionText } from "./remediation";
export { draftSummary } from "./summarizer";
export {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_LINES,
  MAX_IMPORT_LINE_CHARS,
  SYSLOG_TYPES,
  importAlarmText,
  importLimitError,
  parseSyslogText,
  type ImportResult,
  type ParseResult,
} from "./syslog";
export { GENERIC_ANSWER, MAX_QUESTION_CHARS, REFUSAL, TOO_LONG_ANSWER, answerQuestion } from "./answers";
