"""Remediation suggestions grounded in historical runbooks (RAG-lite).

Scores each runbook by keyword overlap with the incident's alert types and
messages, then returns the top matches with the action text. No LLM call:
this is the deterministic stand-in for the REMEDIATION_PROMPT in prompts.py.
"""

import json
import os
import re

_RUNBOOKS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "runbooks.json")


def load_runbooks(path=_RUNBOOKS_PATH):
    with open(path) as f:
        return json.load(f)


def _incident_terms(incident):
    text = " ".join(e["alert_type"] + " " + e["message"] for e in incident["events"])
    return set(re.findall(r"[a-z]+", text.lower()))


def suggest(incident, runbooks=None, top_n=2):
    """Return the top-N runbook matches for an incident."""
    runbooks = runbooks if runbooks is not None else load_runbooks()
    terms = _incident_terms(incident)
    scored = []
    for rb in runbooks:
        keywords = set(rb["keywords"])
        overlap = keywords & terms
        # Weight: keyword overlap, plus a bonus when the symptom vocabulary
        # appears in the timeline.
        score = len(overlap)
        scored.append((score, rb, sorted(overlap)))
    scored.sort(key=lambda item: (-item[0], item[1]["id"]))
    results = []
    for score, rb, overlap in scored[:top_n]:
        results.append({
            "runbook_id": rb["id"],
            "symptom": rb["symptom"],
            "root_cause": rb["root_cause"],
            "recommended_action": rb["action"],
            "matched_terms": overlap,
            "score": score,
            "mttr_before_min": rb["mttr_minutes_before"],
            "mttr_after_min": rb["mttr_minutes_after"],
        })
    return results


def suggestion_text(incident, suggestions):
    """One grounded suggestion paragraph for the demo / voice answer."""
    if not suggestions:
        return "No historical runbook matches this incident. Safest next step: isolate the affected link and collect interface counters."
    top = suggestions[0]
    return (f"Probable cause: {incident['probable_cause']}. "
            f"Recommended action (runbook {top['runbook_id']}): {top['recommended_action']} "
            f"Historical MTTR for this fix: {top['mttr_before_min']} min -> {top['mttr_after_min']} min with the assistant playbook.")
