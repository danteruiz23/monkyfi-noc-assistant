/**
 * Guided tour ("Start demo"): five steps, each on one screen.
 * replay -> incident -> remediation -> closure -> question (SPEC §3, item 8).
 * Pure data, so the order and the texts can be tested without a browser.
 */
import type { StringKey } from "./i18n";
import type { ReplaySpeed } from "./replay";

export type TourScreen = "replay" | "detail" | "remediation" | "summary" | "ask";

export interface TourStep {
  screen: TourScreen;
  title: StringKey;
  body: StringKey;
}

export const TOUR_STEPS: readonly TourStep[] = [
  { screen: "replay", title: "tour1Title", body: "tour1Body" },
  { screen: "detail", title: "tour2Title", body: "tour2Body" },
  { screen: "remediation", title: "tour3Title", body: "tour3Body" },
  { screen: "summary", title: "tour4Title", body: "tour4Body" },
  { screen: "ask", title: "tour5Title", body: "tour5Body" },
] as const;

/** The replay speed the tour uses, so the 19.5-minute arc plays in about 15 seconds. */
export const TOUR_REPLAY_SPEED: ReplaySpeed = 120;

/** The demo question the tour asks on its last step (the probable cause). */
export const TOUR_QUESTION: StringKey = "askQ2";

/** Clamp a step index to the tour. */
export function tourStep(index: number): number {
  return Math.min(Math.max(Math.trunc(index) || 0, 0), TOUR_STEPS.length - 1);
}
