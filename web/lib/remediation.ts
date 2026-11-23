/**
 * Port of backend/remediation.py: runbook suggestions by keyword overlap.
 *
 * Each runbook scores one point per keyword found in the incident's alert
 * types and messages. Ties go to the lower runbook id. No AI call.
 */
import { pyCompare, pySortedUnique, pyStr } from "./py";
import type { Incident, Runbook, Suggestion } from "./types";

function incidentTerms(incident: Incident): Set<string> {
  const text = incident.events.map((e) => `${e.alert_type} ${e.message}`).join(" ");
  return new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
}

/** Return the top-N runbook matches for an incident (default 2). */
export function suggest(incident: Incident, runbooks: readonly Runbook[], topN = 2): Suggestion[] {
  const terms = incidentTerms(incident);
  const scored = runbooks.map((rb) => {
    const overlap = pySortedUnique(rb.keywords.filter((k) => terms.has(k)));
    return { score: overlap.length, rb, overlap };
  });
  scored.sort((a, b) => b.score - a.score || pyCompare(a.rb.id, b.rb.id));
  // Python slicing: a negative top_n counts from the end.
  const end = topN < 0 ? Math.max(scored.length + topN, 0) : topN;
  return scored.slice(0, end).map(({ score, rb, overlap }) => ({
    runbook_id: rb.id,
    symptom: rb.symptom,
    root_cause: rb.root_cause,
    recommended_action: rb.action,
    matched_terms: overlap,
    score,
    mttr_before_min: rb.mttr_minutes_before,
    mttr_after_min: rb.mttr_minutes_after,
  }));
}

/** One grounded remediation paragraph (used by the summary and the answers). */
export function suggestionText(incident: Incident, suggestions: readonly Suggestion[]): string {
  if (suggestions.length === 0) {
    return "No historical runbook matches this incident. Safest next step: isolate the affected link and collect interface counters.";
  }
  const top = suggestions[0];
  return (
    `Probable cause: ${incident.probable_cause}. ` +
    `Recommended action (runbook ${top.runbook_id}): ${top.recommended_action} ` +
    `Historical MTTR for this fix: ${pyStr(top.mttr_before_min)} min -> ${pyStr(top.mttr_after_min)} min with the assistant playbook.`
  );
}
