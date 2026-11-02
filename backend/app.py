#!/usr/bin/env python3
"""NOC Copilot backend skeleton (Python standard library only).

Endpoints (all JSON):
  POST /webhook                    ingest one webhook-format alert event
  GET  /incidents                  list correlated incidents
  GET  /incidents/<id>             incident detail + timeline
  GET  /incidents/<id>/remediation grounded remediation suggestion
  GET  /incidents/<id>/summary     ticket-closure summary draft
  POST /voice/query {"question": "..."}  text answer for the voice demo
       (spoken delivery via ElevenLabs is the llm_client.speak() integration
        point; scaffolding returns text only, no live voice calls)

Run:  python3 app.py [--port 8000] [--load ../data/alerts.json]
"""

import argparse
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

sys.path.insert(0, __file__.rsplit("/", 1)[0])

from correlator import correlate, peak_packet_loss, peak_utilization  # noqa: E402
from remediation import load_runbooks, suggest, suggestion_text  # noqa: E402
from summarizer import draft_summary  # noqa: E402
from llm_client import NotConfiguredError, VoiceServiceError, speak  # noqa: E402

EVENTS = []
RUNBOOKS = load_runbooks()

SYSLOG_PATTERN = re.compile(
    r"^<\d+>\d+ (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ) "
    r"(\S+) (\S+): (\S+) (\w+)=([^ ]+) (.*)$"
)
SYSLOG_TYPES = {
    "BGP-5-ADJCHANGE": "bgp_flap",
    "LINK-4-UTILIZATION": "link_saturation",
    "QOS-3-PACKETLOSS": "packet_loss",
    "OPTIC-4-RXPOWER": "optical_degradation",
    "NOC-6-TICKET": "ticket",
}


def parse_syslog_text(text):
    """Parse simulator-style syslog lines into webhook alert events."""
    parsed = []
    invalid = 0
    for line_number, line in enumerate(text.splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        match = SYSLOG_PATTERN.match(line)
        if not match:
            invalid += 1
            continue
        timestamp, device, code, interface, metric_name, raw_value, message = match.groups()
        alert_type = SYSLOG_TYPES.get(code)
        if not alert_type:
            invalid += 1
            continue
        try:
            value = float(raw_value) if any(c in raw_value for c in ".eE") else int(raw_value)
        except ValueError:
            value = raw_value
        severity = "major"
        if alert_type == "bgp_flap" and metric_name == "bgp_neighbor_state" and value == "down":
            severity = "critical"
        elif alert_type == "link_saturation" and isinstance(value, (int, float)) and value >= 95:
            severity = "critical"
        elif alert_type == "packet_loss" and isinstance(value, (int, float)) and value >= 10:
            severity = "critical"
        event = {
            "event_id": f"import-{len(EVENTS) + len(parsed) + 1:06d}",
            "timestamp": timestamp,
            "source": "syslog-import",
            "alert_type": alert_type,
            "severity": severity,
            "device": device,
            "interface": interface,
            "metric": {"name": metric_name, "value": value},
            "message": message,
            "syslog": line,
        }
        if metric_name == "ticket_id":
            event["ticket_id"] = str(value)
            event["ticket_action"] = "created" if "opened" in message.lower() else "updated"
        parsed.append(event)
    return parsed, invalid


def incidents():
    return correlate(EVENTS)


def find_incident(incident_id):
    for inc in incidents():
        if inc["id"] == incident_id:
            return inc
    return None


def voice_answer(question):
    """Deterministic answers for the 3-minute demo questions."""
    q = question.lower()
    incs = incidents()
    main = incs[0] if incs else None
    if "satur" in q:
        if not main:
            return "No saturation alerts right now."
        return (f"Uplink Te0/0/0/0 on MIA-EDGE-02 peaked at "
                f"{peak_utilization(main)}% utilization.")
    if "causa" in q or "cause" in q or "probable" in q:
        if not main:
            return "No active incident to diagnose."
        return suggestion_text(main, suggest(main, RUNBOOKS))
    if "impact" in q:
        if not main:
            return "No active incident."
        return (f"{main['event_count']} alerts correlated into one incident. "
                f"Peak packet loss {peak_packet_loss(main)}%, "
                f"{len(main['ticket_ids'])} duplicate tickets merged.")
    return ("I can answer: which links are saturated, the probable cause, "
            "or the impact of the current incident.")


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length) or b"{}")

    def _send_audio(self, audio):
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/webhook":
            event = self._read_json()
            EVENTS.append(event)
            self._send(200, {"ok": True, "stored_events": len(EVENTS)})
        elif path == "/alerts/import":
            try:
                body = self._read_json()
            except (ValueError, TypeError):
                self._send(400, {"error": "invalid JSON body"})
                return
            text = body.get("text") if isinstance(body, dict) else None
            if not isinstance(text, str) or not text.strip():
                self._send(400, {"error": "paste syslog alarm lines or select a non-empty text file"})
                return
            events, invalid = parse_syslog_text(text)
            if not events:
                self._send(400, {"error": "no supported syslog alarms found; expected simulator-style syslog lines"})
                return
            EVENTS.extend(events)
            self._send(200, {"ok": True, "imported": len(events), "ignored": invalid})
        elif path == "/voice/query":
            body = self._read_json()
            self._send(200, {"answer": voice_answer(body.get("question", ""))})
        elif path == "/voice/audio":
            try:
                body = self._read_json()
            except (ValueError, TypeError):
                self._send(400, {"error": "invalid JSON body"})
                return
            text = body.get("text") if isinstance(body, dict) else None
            if not isinstance(text, str) or not text.strip():
                self._send(400, {"error": "text must be a non-empty string"})
                return
            try:
                self._send_audio(speak(text, allow_live=True))
            except NotConfiguredError:
                self._send(503, {"error": "ElevenLabs is not configured"})
            except VoiceServiceError:
                self._send(502, {"error": "ElevenLabs speech generation failed"})
        else:
            self._send(404, {"error": "unknown endpoint"})

    def do_GET(self):
        parts = [p for p in urlparse(self.path).path.split("/") if p]
        if not parts:
            # Live frontend panel: same-origin, so no CORS is needed.
            panel = __file__.rsplit("/", 2)[0] + "/frontend/index.html"
            try:
                with open(panel, "rb") as f:
                    body = f.read()
            except OSError:
                self._send(404, {"error": "frontend panel not found"})
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parts == ["frontend", "monkyfi-logo.png"]:
            logo = __file__.rsplit("/", 2)[0] + "/frontend/monkyfi-logo.png"
            try:
                with open(logo, "rb") as f:
                    body = f.read()
            except OSError:
                self._send(404, {"error": "brand logo not found"})
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif parts == ["incidents"]:
            self._send(200, {"incidents": incidents()})
        elif len(parts) == 2 and parts[0] == "incidents":
            inc = find_incident(parts[1])
            if inc is None:
                self._send(404, {"error": "incident not found"})
            else:
                self._send(200, {"incident": inc})
        elif len(parts) == 3 and parts[0] == "incidents" and parts[2] == "remediation":
            inc = find_incident(parts[1])
            if inc is None:
                self._send(404, {"error": "incident not found"})
            else:
                sugg = suggest(inc, RUNBOOKS)
                self._send(200, {"suggestions": sugg, "text": suggestion_text(inc, sugg)})
        elif len(parts) == 3 and parts[0] == "incidents" and parts[2] == "summary":
            inc = find_incident(parts[1])
            if inc is None:
                self._send(404, {"error": "incident not found"})
            else:
                self._send(200, {"summary": draft_summary(inc, suggest(inc, RUNBOOKS))})
        else:
            self._send(404, {"error": "unknown endpoint"})

    def log_message(self, *args):  # keep stdout clean for the demo
        pass


def main():
    parser = argparse.ArgumentParser(description="NOC Copilot backend")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--load", default=None,
                        help="preload events from a JSON file (e.g. ../data/alerts.json)")
    args = parser.parse_args()
    if args.load:
        with open(args.load) as f:
            EVENTS.extend(json.load(f))
        print(f"loaded {len(EVENTS)} events from {args.load}")
    print(f"NOC Copilot backend on http://localhost:{args.port}")
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
