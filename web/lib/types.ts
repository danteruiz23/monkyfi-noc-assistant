/**
 * Data shapes shared by the ported logic. Field names stay snake_case so they
 * match the Python backend's JSON (data/alerts.json and the HTTP API).
 */
import type { PyFloat } from "./py";

/** A metric value as json.load() or the syslog parser produce it. */
export type MetricValue = number | bigint | boolean | PyFloat | string | null | unknown[] | object;

export type AlertType =
  | "bgp_flap"
  | "link_saturation"
  | "packet_loss"
  | "optical_degradation"
  | "ticket"
  | (string & {});

export interface AlertEvent {
  event_id: string;
  timestamp: string;
  source: string;
  alert_type: AlertType;
  severity: string;
  device: string;
  interface: string;
  metric: { name: string; value: MetricValue };
  message: string;
  syslog?: string;
  ticket_id?: string;
  ticket_action?: string;
  [extra: string]: unknown;
}

export interface Incident {
  id: string;
  title: string;
  primary_device: string;
  events: AlertEvent[];
  ticket_ids: string[];
  probable_cause: string;
  start: string;
  end: string;
  /** Always a Python float; print with pyFloatRepr(). */
  duration_minutes: number;
  event_count: number;
}

export interface Runbook {
  id: string;
  symptom: string;
  root_cause: string;
  action: string;
  keywords: string[];
  mttr_minutes_before: number;
  mttr_minutes_after: number;
  [extra: string]: unknown;
}

export interface Suggestion {
  runbook_id: string;
  symptom: string;
  root_cause: string;
  recommended_action: string;
  matched_terms: string[];
  score: number;
  mttr_before_min: number;
  mttr_after_min: number;
}
