"""Incident summary draft generator (ticket-closure text).

Deterministic stand-in for the SUMMARY_PROMPT in prompts.py: builds the
closure draft from the correlated timeline, peak metrics, and the grounded
remediation suggestion.
"""

from correlator import affected_customers, peak_packet_loss, peak_utilization
from remediation import suggestion_text


def draft_summary(incident, suggestions):
    """Return a ticket-closure summary string for one incident."""
    customers = affected_customers(incident)
    devices = sorted({e["device"] for e in incident["events"]})
    links = sorted({e["interface"] for e in incident["events"]})
    key_events = []
    seen_types = set()
    for e in incident["events"]:
        # One representative line per alert type, in timeline order.
        if e["alert_type"] not in seen_types:
            key_events.append(f"- {e['timestamp']} {e['device']} {e['interface']}: {e['message']}")
            seen_types.add(e["alert_type"])
    lines = [
        f"Incident: {incident['title']}",
        f"Window: {incident['start']} -> {incident['end']} ({incident['duration_minutes']} min)",
        f"Devices: {', '.join(devices)}",
        f"Links: {', '.join(links)}",
        f"Alerts correlated: {incident['event_count']}",
        f"Peak packet loss: {peak_packet_loss(incident)}%",
        f"Peak uplink utilization: {peak_utilization(incident)}%",
        f"Customers affected: {', '.join(customers) if customers else 'none reported'}",
        f"Duplicate tickets merged: {', '.join(incident['ticket_ids']) if incident['ticket_ids'] else 'none'}",
        "",
        "Key timeline:",
        *key_events,
        "",
        "Remediation:",
        suggestion_text(incident, suggestions),
    ]
    return "\n".join(lines)
