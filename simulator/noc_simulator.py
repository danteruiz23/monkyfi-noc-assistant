#!/usr/bin/env python3
"""NOC simulator for the Hackathon NOC Copilot (combo 1+4).

Emits alert events in real webhook format (JSON lines), NOT hardcoded UI data.
The event stream follows one coherent 20-minute incident arc:

  02:00  BGP flap on edge router MIA-EDGE-02
  02:02  Uplink saturation on MIA-EDGE-02 uplinks
  02:05  Packet loss on downstream customer links (peak 12%)
  02:04  Duplicate tickets for the same incident (to be merged by the copilot)
  02:06  Optical degradation on DFW-CORE-01 (separate, minor incident)
  02:16  Recovery

Usage:
  # Print the full arc as a fast JSON-lines stream (stdout):
  python3 noc_simulator.py --stream

  # Stream with a delay between events (seconds):
  python3 noc_simulator.py --stream --interval 1.0

  # POST each event to a webhook endpoint (e.g. the backend):
  python3 noc_simulator.py --stream --webhook http://localhost:8000/webhook

  # Write the deterministic dataset used by the demo:
  python3 noc_simulator.py --generate --out ../data
"""

import argparse
import json
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

T0 = datetime(2026, 11, 4, 2, 0, 0, tzinfo=timezone.utc)

# ---------------------------------------------------------------------------
# Incident arc definition: (offset_seconds, alert_type, severity, device,
#                          interface, metric_name, metric_value, message)
# ---------------------------------------------------------------------------
ARC = []


def _add(offset, alert_type, severity, device, interface, metric, value, message, extra=None):
    event = {
        "offset_seconds": offset,
        "alert_type": alert_type,
        "severity": severity,
        "device": device,
        "interface": interface,
        "metric": {"name": metric, "value": value},
        "message": message,
    }
    if extra:
        event.update(extra)
    ARC.append(event)


# Phase A — BGP flap on MIA-EDGE-02 (02:00:00–02:03:30)
_bgp_states = [("down", "critical"), ("up", "major"), ("down", "critical"),
               ("up", "major"), ("down", "critical"), ("up", "major")]
for i, (state, sev) in enumerate(_bgp_states):
    _add(30 + i * 35, "bgp_flap", sev, "MIA-EDGE-02", "Te0/0/0/1",
         "bgp_neighbor_state", state,
         f"BGP neighbor 198.51.100.2 (AS 64512) state changed to {state} "
         f"on MIA-EDGE-02 (flap {i + 1}/6)")
_add(200, "bgp_flap", "major", "MIA-EDGE-02", "Te0/0/0/1",
     "bgp_hold_timer_expiry", 1,
     "BGP hold timer expired for neighbor 198.51.100.2 on MIA-EDGE-02")
_add(210, "bgp_flap", "critical", "MIA-EDGE-02", "Te0/0/0/1",
     "bgp_prefix_count", 0,
     "BGP neighbor 198.51.100.2 advertising 0 prefixes (was 18432)")

# Phase B — uplink saturation (02:02:30–02:11:00)
_uplink_series = [(150, 81), (190, 85), (230, 88), (280, 91),
                  (330, 94), (390, 96), (450, 97), (520, 95)]
for offset, util in _uplink_series:
    _add(offset, "link_saturation", "major" if util < 95 else "critical",
         "MIA-EDGE-02", "Te0/0/0/0", "link_utilization_pct", util,
         f"Uplink Te0/0/0/0 utilization at {util}% (threshold 80%) on MIA-EDGE-02")
for offset, util in [(260, 79), (360, 86), (480, 93), (600, 90)]:
    _add(offset, "link_saturation", "major", "MIA-EDGE-02", "Te0/0/0/1",
         "link_utilization_pct", util,
         f"Uplink Te0/0/0/1 utilization at {util}% (threshold 80%) on MIA-EDGE-02")

# Phase C — packet loss on downstream links (02:05:00–02:16:00)
_loss_series = [(300, 3.1), (340, 5.4), (400, 7.8), (460, 9.6),
                (540, 11.2), (620, 12.0), (700, 10.4), (780, 7.1),
                (860, 4.2), (940, 1.8)]
for offset, loss in _loss_series:
    _add(offset, "packet_loss", "major" if loss < 10 else "critical",
         "MIA-AGG-01", "Te0/0/1/0", "packet_loss_pct", loss,
         f"Packet loss {loss}% on MIA-AGG-01 Te0/0/1/0 towards customer edge")
_add(560, "packet_loss", "critical", "MIA-CORE-01", "Te0/0/2/0",
     "packet_loss_pct", 12.0,
     "Packet loss 12.0% on MIA-CORE-01 Te0/0/2/0; 2 enterprise customers affected (ACME Corp, Globex)")
_add(700, "packet_loss", "major", "MIA-AGG-01", "Te0/0/1/1",
     "packet_loss_pct", 8.4,
     "Packet loss 8.4% on MIA-AGG-01 Te0/0/1/1 (secondary path, load-shared)")
_add(960, "packet_loss", "minor", "MIA-AGG-01", "Te0/0/1/0",
     "packet_loss_pct", 0.5,
     "Packet loss recovered to 0.5% on MIA-AGG-01 Te0/0/1/0")
_add(990, "packet_loss", "minor", "MIA-CORE-01", "Te0/0/2/0",
     "packet_loss_pct", 0.4,
     "Packet loss recovered to 0.4% on MIA-CORE-01 Te0/0/2/0")

# Phase D — duplicate tickets for the same incident (02:04:00–02:12:00)
_ticket_defs = [
    (240, "INC-1042", "created", "NOC engineer opened ticket for BGP flap on MIA-EDGE-02"),
    (300, "INC-1043", "created", "Monitoring tool auto-opened ticket for uplink saturation on MIA-EDGE-02"),
    (360, "INC-1044", "created", "Customer ACME Corp reported packet loss, ticket opened"),
    (540, "INC-1042", "updated", "Engineer notes: loss correlates with BGP flap window"),
    (660, "INC-1043", "updated", "Auto-update: utilization still above 95%"),
    (720, "INC-1044", "updated", "Customer confirms impact on 2 enterprise circuits"),
]
for offset, ticket_id, action, note in _ticket_defs:
    _add(offset, "ticket_created" if action == "created" else "ticket_updated",
         "major", "MIA-EDGE-02", "Te0/0/0/1", "ticket_id", ticket_id,
         note, extra={"ticket_id": ticket_id, "ticket_action": action})

# Phase E — optical degradation, separate device/incident (02:06:00–02:14:00)
_optics = [(360, -18.2, "minor"), (460, -20.1, "minor"), (580, -22.4, "major"),
           (700, -24.1, "major"), (800, -25.0, "critical")]
for offset, rx, sev in _optics:
    _add(offset, "optical_degradation", sev, "DFW-CORE-01", "Hu0/0/0/2",
         "optical_rx_power_dbm", rx,
         f"Optical Rx power {rx} dBm on DFW-CORE-01 Hu0/0/0/2 (threshold -24 dBm)")
_add(840, "ticket_created", "major", "DFW-CORE-01", "Hu0/0/0/2",
     "ticket_id", "INC-1045",
     "Ticket opened for optical degradation on DFW-CORE-01",
     extra={"ticket_id": "INC-1045", "ticket_action": "created"})

# Phase F — recovery (02:16:00–02:20:00)
_add(960, "bgp_flap", "minor", "MIA-EDGE-02", "Te0/0/0/1",
     "bgp_neighbor_state", "up",
     "BGP neighbor 198.51.100.2 stable, 0 flaps in last 5 minutes")
_add(1020, "link_saturation", "minor", "MIA-EDGE-02", "Te0/0/0/0",
     "link_utilization_pct", 62,
     "Uplink Te0/0/0/0 utilization normalized to 62% on MIA-EDGE-02")
_add(1080, "ticket_updated", "minor", "MIA-EDGE-02", "Te0/0/0/1",
     "ticket_id", "INC-1042",
     "Incident monitoring: all customer metrics green for 5 minutes",
     extra={"ticket_id": "INC-1042", "ticket_action": "updated"})
_add(1200, "ticket_updated", "minor", "MIA-EDGE-02", "Te0/0/0/1",
     "ticket_id", "INC-1042",
     "Incident ready for closure summary",
     extra={"ticket_id": "INC-1042", "ticket_action": "updated"})

ARC.sort(key=lambda e: e["offset_seconds"])
assert len(ARC) == 50, f"arc must be 50 events, got {len(ARC)}"


# ---------------------------------------------------------------------------
# Event materialization
# ---------------------------------------------------------------------------
def build_event(raw, index):
    """Turn an arc entry into a full webhook-format event dict."""
    ts = T0 + timedelta(seconds=raw["offset_seconds"])
    event = {
        "event_id": f"evt-{index + 1:04d}",
        "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "noc-simulator",
        "alert_type": raw["alert_type"],
        "severity": raw["severity"],
        "device": raw["device"],
        "interface": raw["interface"],
        "metric": raw["metric"],
        "message": raw["message"],
    }
    if "ticket_id" in raw:
        event["ticket_id"] = raw["ticket_id"]
        event["ticket_action"] = raw["ticket_action"]
    event["syslog"] = syslog_line(event)
    return event


_SYSLOG_FACILITY = {
    "bgp_flap": "BGP-5-ADJCHANGE",
    "link_saturation": "LINK-4-UTILIZATION",
    "packet_loss": "QOS-3-PACKETLOSS",
    "optical_degradation": "OPTIC-4-RXPOWER",
    "ticket_created": "NOC-6-TICKET",
    "ticket_updated": "NOC-6-TICKET",
}


def syslog_line(event):
    """One realistic syslog line per event (Cisco IOS-XR style)."""
    code = _SYSLOG_FACILITY[event["alert_type"]]
    metric = event["metric"]
    return (f"<134>1 {event['timestamp']} {event['device']} {code}: "
            f"{event['interface']} {metric['name']}={metric['value']} "
            f"{event['message']}")


def generate_events():
    return [build_event(raw, i) for i, raw in enumerate(ARC)]


def post_event(url, event):
    req = urllib.request.Request(
        url, data=json.dumps(event).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status


def main():
    parser = argparse.ArgumentParser(description="NOC alert simulator")
    parser.add_argument("--stream", action="store_true",
                        help="emit the arc as a JSON-lines stream")
    parser.add_argument("--interval", type=float, default=0.0,
                        help="seconds to wait between events (default: 0)")
    parser.add_argument("--webhook", default=None,
                        help="POST each event to this URL instead of stdout")
    parser.add_argument("--generate", action="store_true",
                        help="write data/alerts.json and data/syslog.txt")
    parser.add_argument("--out", default="data",
                        help="output directory for --generate")
    args = parser.parse_args()

    events = generate_events()

    if args.generate:
        import os
        os.makedirs(args.out, exist_ok=True)
        with open(os.path.join(args.out, "alerts.json"), "w") as f:
            json.dump(events, f, indent=2)
        with open(os.path.join(args.out, "syslog.txt"), "w") as f:
            for e in events:
                f.write(e["syslog"] + "\n")
        print(f"wrote {len(events)} events to {args.out}/alerts.json "
              f"and {args.out}/syslog.txt", file=sys.stderr)
        return

    if args.stream:
        try:
            for e in events:
                if args.webhook:
                    try:
                        post_event(args.webhook, e)
                    except Exception as exc:  # noqa: BLE001 - demo tooling
                        print(f"webhook POST failed for {e['event_id']}: {exc}",
                              file=sys.stderr)
                else:
                    print(json.dumps(e))
                    sys.stdout.flush()
                if args.interval:
                    time.sleep(args.interval)
        except BrokenPipeError:
            pass  # downstream closed the pipe (e.g. `| head`)
        return

    parser.print_help()


if __name__ == "__main__":
    main()
