/**
 * Live replay helpers: play the simulator events in the browser, sped up,
 * keeping the real gaps between alarms (scaled and clamped so the demo
 * stays watchable).
 */
import { parseTimestamp } from "./correlator";
import { pyCompare } from "./py";
import type { AlertEvent } from "./types";

export const REPLAY_SPEEDS = [30, 60, 120] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
export const DEFAULT_SPEED: ReplaySpeed = 60;

/** Shortest and longest wait between two alarms on screen, in ms. */
export const MIN_GAP_MS = 120;
export const MAX_GAP_MS = 2500;

/** Events in the order they reach the NOC (by timestamp; ties keep file order). */
export function replayOrder(events: readonly AlertEvent[]): AlertEvent[] {
  return [...events].sort((a, b) => pyCompare(a.timestamp, b.timestamp));
}

/**
 * Wait in ms before showing event `index` (0 = the first event, shown at once).
 * The real gap is divided by `speed` and clamped to [MIN_GAP_MS, MAX_GAP_MS].
 */
export function replayDelay(ordered: readonly AlertEvent[], index: number, speed: number): number {
  if (index <= 0 || index >= ordered.length) return 0;
  const gap = parseTimestamp(ordered[index].timestamp) - parseTimestamp(ordered[index - 1].timestamp);
  return Math.min(MAX_GAP_MS, Math.max(MIN_GAP_MS, gap / speed));
}

/** Total replay length in ms at a given speed. */
export function replayLength(ordered: readonly AlertEvent[], speed: number): number {
  let total = 0;
  for (let i = 1; i < ordered.length; i++) total += replayDelay(ordered, i, speed);
  return total;
}
