"""Prompt templates for the NOC Copilot backend.

These are the three LLM prompts from the kickoff pack. They are templates
only: the scaffolding runs on deterministic logic (correlator.py,
remediation.py, summarizer.py) and never calls a paid API. When an
ANTHROPIC_API_KEY is configured, llm_client.py can render these templates
and send them to Claude; until then they document the intended behavior.
"""

CORRELATION_PROMPT = """You are a NOC incident correlator. Given the following alert events
(JSON, in chronological order), group related alerts into incidents.

Rules:
- Alerts on the same device cluster within a 30-minute window that share a
  causal chain (e.g. BGP flap -> link saturation -> packet loss) belong to
  ONE incident.
- Duplicate tickets for the same underlying problem merge into that incident.
- Alerts on unrelated devices with no shared cause stay separate incidents.

For each incident return: title, primary device, start/end time, event count,
a timeline of the key events, and the probable root cause in one line.

ALERTS:
{events_json}
"""

REMEDIATION_PROMPT = """You are a NOC remediation advisor. Given the incident timeline below and
the historical runbooks below, suggest the next remediation step.

Rules:
- Ground every suggestion in a cited runbook (id + action). Do not invent
  procedures that are not in the runbooks.
- Prefer the runbook whose symptoms best match the incident timeline.
- If no runbook matches, say so and suggest the safest diagnostic next step.

INCIDENT TIMELINE:
{timeline}

HISTORICAL RUNBOOKS:
{runbooks_json}

Return: recommended action, runbook id cited, and the evidence from the
timeline that supports it.
"""

SUMMARY_PROMPT = """You are a NOC incident scribe. Draft a ticket-closure summary from the
incident below.

Include: incident title, start/end and duration, affected devices and links,
peak impact metrics, customers affected, timeline of key events, actions
taken, and the remediation that resolved it. Keep it factual and concise,
suitable to paste into the incident ticket.

INCIDENT:
{incident_json}
"""


def render(template, **kwargs):
    """Render a prompt template with the given fields."""
    return template.format(**kwargs)
