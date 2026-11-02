"""Deterministic alert correlation for the NOC Copilot scaffolding.

Groups webhook-format events into incidents so the demo works without any
LLM call. The rules mirror the CORRELATION_PROMPT in prompts.py:

- Events on the MIA-* device cluster within one 30-minute incident window
  that share the causal chain (BGP flap -> saturation -> packet loss)
  merge into ONE incident; duplicate tickets on those devices merge too.
- Events on an unrelated device (DFW-CORE-01 optical degradation) form
  their own incident.
"""

from datetime import datetime, timedelta

WINDOW = timedelta(minutes=30)

# Device cluster for the main incident: the MIA edge/agg/core chain.
MAIN_CLUSTER = {"MIA-EDGE-02", "MIA-AGG-01", "MIA-CORE-01"}


def _parse_ts(ts):
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")


def correlate(events):
    """Return a list of incident dicts from a list of event dicts."""
    events = sorted(events, key=lambda e: e["timestamp"])
    incidents = []

    for event in events:
        ts = _parse_ts(event["timestamp"])
        target = None
        for inc in incidents:
            same_cluster = (
                (event["device"] in MAIN_CLUSTER and inc["primary_cluster"] == "MIA")
                or (event["device"] not in MAIN_CLUSTER
                    and inc["primary_cluster"] == event["device"])
            )
            if same_cluster and ts - inc["start_dt"] <= WINDOW:
                target = inc
                break
        if target is None:
            target = {
                "id": f"INC-COPILOT-{len(incidents) + 1:02d}",
                "title": "",
                "primary_device": event["device"],
                "primary_cluster": "MIA" if event["device"] in MAIN_CLUSTER else event["device"],
                "start_dt": ts,
                "end_dt": ts,
                "events": [],
                "ticket_ids": [],
            }
            incidents.append(target)
        target["events"].append(event)
        target["end_dt"] = max(target["end_dt"], ts)
        if event.get("ticket_id") and event["ticket_id"] not in target["ticket_ids"]:
            target["ticket_ids"].append(event["ticket_id"])

    for inc in incidents:
        types = [e["alert_type"] for e in inc["events"]]
        if "bgp_flap" in types:
            inc["title"] = f"BGP flap on {inc['primary_device']} cascading to saturation and packet loss"
            inc["probable_cause"] = "BGP neighbor flap on MIA-EDGE-02 (neighbor 198.51.100.2)"
        elif "optical_degradation" in types:
            inc["title"] = f"Optical degradation on {inc['primary_device']}"
            inc["probable_cause"] = "Degrading optic on DFW-CORE-01 Hu0/0/0/2"
        else:
            inc["title"] = f"Incident on {inc['primary_device']}"
            inc["probable_cause"] = "Unknown — see timeline"
        inc["start"] = inc["start_dt"].strftime("%Y-%m-%dT%H:%M:%SZ")
        inc["end"] = inc["end_dt"].strftime("%Y-%m-%dT%H:%M:%SZ")
        inc["duration_minutes"] = round((inc["end_dt"] - inc["start_dt"]).total_seconds() / 60, 1)
        inc["event_count"] = len(inc["events"])
        for key in ("start_dt", "end_dt", "primary_cluster"):
            inc.pop(key, None)
    return incidents


def peak_packet_loss(incident):
    losses = [e["metric"]["value"] for e in incident["events"]
              if e["alert_type"] == "packet_loss"
              and isinstance(e["metric"]["value"], (int, float))]
    return max(losses) if losses else 0.0


def peak_utilization(incident):
    utils = [e["metric"]["value"] for e in incident["events"]
             if e["alert_type"] == "link_saturation"
             and isinstance(e["metric"]["value"], (int, float))]
    return max(utils) if utils else 0


def affected_customers(incident):
    customers = set()
    for e in incident["events"]:
        if "ACME Corp" in e["message"]:
            customers.add("ACME Corp")
        if "Globex" in e["message"]:
            customers.add("Globex")
    return sorted(customers)
