"use client";

import { useEffect, useRef } from "react";
import { fmt, type Strings } from "@/lib/i18n";
import { TOUR_STEPS } from "@/lib/tour";

/**
 * The guided tour panel: a card pinned to the bottom of the window that
 * explains the screen behind it. It does not block the page, so the person
 * giving the demo can still click around. Escape closes it.
 */
export default function GuidedTour({
  t,
  step,
  onNext,
  onBack,
  onExit,
}: {
  t: Strings;
  step: number;
  onNext: () => void;
  onBack: () => void;
  onExit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const current = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  // Move focus to the step title, so keyboard and screen-reader users follow the tour.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  return (
    <aside
      className="tour"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      data-testid="tour"
      data-step={step + 1}
    >
      <div className="tour-head">
        <span className="label">
          {t.tourLabel} · {fmt(t.tourStepOf, { n: step + 1, total: TOUR_STEPS.length })}
        </span>
        <button type="button" className="btn ghost small" onClick={onExit} data-testid="tour-exit">
          {t.tourExit}
        </button>
      </div>
      <h2 id="tour-title" ref={heading} tabIndex={-1}>
        {t[current.title]}
      </h2>
      <p id="tour-body">{t[current.body]}</p>
      <ol className="tour-dots" aria-hidden="true">
        {TOUR_STEPS.map((s, i) => (
          <li key={s.screen} className={i === step ? "on" : i < step ? "done" : undefined} />
        ))}
      </ol>
      <div className="row">
        <button type="button" className="btn ghost" onClick={onBack} disabled={step === 0} data-testid="tour-back">
          {t.tourBack}
        </button>
        <button type="button" className="btn" onClick={last ? onExit : onNext} data-testid="tour-next">
          {last ? t.tourFinish : t.tourNext}
        </button>
      </div>
    </aside>
  );
}
