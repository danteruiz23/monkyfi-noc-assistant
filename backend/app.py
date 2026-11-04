#!/usr/bin/env python3
"""NOC Copilot backend (Python standard library only).

Endpoints:
  GET  /                           live incident panel (frontend/index.html)
  POST /webhook                    ingest one webhook-format alert event
  POST /alerts/import              import simulator-style syslog alarm text
  GET  /incidents                  list correlated incidents
  GET  /incidents/<id>             incident detail + timeline
  GET  /incidents/<id>/remediation grounded remediation suggestion
  GET  /incidents/<id>/summary     ticket-closure summary draft
  POST /voice/query {"question": "..."}
                                   deterministic text answer for the voice demo
  POST /voice/audio {"text": "..."}
                                   spoken answer (audio/mpeg) via ElevenLabs
  POST /voice/transcribe           multipart audio file; returns {"text": "..."}

POST /voice/query answers only the current NOC incident and never treats the
question as instructions. POST /voice/audio calls ElevenLabs when
ELEVENLABS_API_KEY is set, caches the most recent clips, and does not call
out again for a repeated line. It returns 503 when ElevenLabs is not
configured and 502 when speech generation fails. POST /voice/transcribe
returns 503 when ElevenLabs is not configured, 400 for empty or invalid
audio, and 502 when transcription fails. It never invents a transcript.

Run:  python3 app.py [--port 8000] [--load ../data/alerts.json]
"""

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

sys.path.insert(0, __file__.rsplit("/", 1)[0])

from correlator import (  # noqa: E402
    affected_customers,
    correlate,
    peak_packet_loss,
    peak_utilization,
)
from remediation import load_runbooks, suggest, suggestion_text  # noqa: E402
from summarizer import draft_summary  # noqa: E402
from llm_client import NotConfiguredError, VoiceServiceError, speak, transcribe  # noqa: E402

EVENTS = []
RUNBOOKS = load_runbooks()
VOICE_AUDIO_CACHE = OrderedDict()
VOICE_AUDIO_CACHE_LIMIT = 50
MAX_AUDIO_BYTES = 8 * 1024 * 1024

# User text is matched as data. These patterns never become code or prompts.
_MALICIOUS_RE = re.compile(
    r"("
    r"\b(passwords?|credentials?|credenciales|contrasenas?|secrets?)\b|"
    r"\bapi[-_ ]?keys?\b|\baccess tokens?\b|\bbearer\b|"
    r"\b(sabot\w*|ddos|exploits?|malware|ransomware|hack(?:ing|er|ed)?)\b|"
    r"\b(evadir|evade|evasion|bypass)\b|"
    r"\bjailbreaks?\b|"
    r"ignore (?:(?:all |any |previous |prior |above )*)(?:instructions|prompts)|"
    r"\bsystem prompt\b|"
    r"\bhow (?:do i|to) (?:attack|hack|exploit)\b|"
    r"\b(?:shut ?down|take down|disable) (?:the )?(?:monitor\w*|alarms?|logging|controls)\b"
    r")",
    re.IGNORECASE,
)
_SCOPE_RE = re.compile(
    r"("
    r"\b(noc|incidents?|incidentes?|alerts?|alarmas?|links?|enlaces?)\b|"
    r"\b(bgp|packets?|losses?|loss|uplinks?|devices?|dispositivos?)\b|"
    r"\b(runbooks?|remedi\w*|customers?|clientes?|networks?|outages?)\b|"
    r"\b(flaps?|optics?|utiliz\w*|summar(?:y|ies)|resumen\w*)\b|"
    r"\b(satur\w*|causes?|causas?|impacts?|impactos?|tickets?|fusion\w*)\b|"
    r"\b(durations?|duracion\w*|interfaces?|syslogs?|correlat\w*)\b|"
    r"\b(routers?|switches?|latenc\w*|mia-|dfw-)\b|"
    r"how long|cuanto duro"
    r")",
    re.IGNORECASE,
)
_GENERIC_ANSWER = (
    "I can answer: which links are saturated, the probable cause, "
    "the impact, which tickets were merged, how long the incident lasted, "
    "or which customers are affected."
)
_REFUSAL = "Sorry, I can only answer questions about the current NOC incident."

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


def _fold(text):
    """Lowercase and strip accents so matching stays data-only."""
    folded = unicodedata.normalize("NFD", text.lower())
    return "".join(ch for ch in folded if unicodedata.category(ch) != "Mn")


def cached_voice_audio(text):
    """Return speech bytes, reusing the last 50 clips for the same text and voice."""
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "").strip() or "auto"
    key = hashlib.sha256(f"{voice_id}\n{text}".encode("utf-8")).hexdigest()
    cached = VOICE_AUDIO_CACHE.get(key)
    if cached is not None:
        VOICE_AUDIO_CACHE.move_to_end(key)
        return cached
    audio = speak(text, allow_live=True)
    VOICE_AUDIO_CACHE[key] = audio
    VOICE_AUDIO_CACHE.move_to_end(key)
    while len(VOICE_AUDIO_CACHE) > VOICE_AUDIO_CACHE_LIMIT:
        VOICE_AUDIO_CACHE.popitem(last=False)
    return audio


def voice_answer(question):
    """Deterministic answers for the demo. Questions are data, never instructions."""
    if not isinstance(question, str) or not question.strip():
        return _GENERIC_ANSWER
    q = _fold(question)
    if _MALICIOUS_RE.search(q):
        return _REFUSAL
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
    if "ticket" in q or "fusion" in q:
        if not main:
            return "No active incident."
        tickets = main["ticket_ids"]
        if not tickets:
            return "No duplicate tickets were merged for the current incident."
        return f"{len(tickets)} duplicate tickets merged: {', '.join(tickets)}."
    if any(token in q for token in ("duration", "duracion", "how long", "lasted", "cuanto duro")):
        if not main:
            return "No active incident."
        return (f"The incident lasted {main['duration_minutes']} minutes, "
                f"from {main['start']} to {main['end']}.")
    if "customer" in q or "cliente" in q:
        if not main:
            return "No active incident."
        customers = affected_customers(main)
        if not customers:
            return "No affected customers are identified on the current incident."
        return f"Affected customers: {', '.join(customers)}."
    if _SCOPE_RE.search(q):
        return _GENERIC_ANSWER
    return _REFUSAL


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

    def _read_audio_upload(self):
        """Return (audio_bytes, content_type) from a multipart upload. Not stored."""
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
        except ValueError:
            raise ValueError("invalid multipart body")
        if length <= 0:
            raise ValueError("empty audio")
        if length > MAX_AUDIO_BYTES:
            raise ValueError("audio is too large")
        body = self.rfile.read(length)
        content_type = self.headers.get("Content-Type", "")
        if not content_type.lower().startswith("multipart/"):
            raise ValueError("invalid multipart body")
        match = re.search(r'boundary="?([^";]+)"?', content_type, re.I)
        if not match:
            raise ValueError("invalid multipart body")
        boundary = match.group(1).encode()
        for chunk in body.split(b"--" + boundary):
            if chunk in (b"", b"--", b"--\r\n") or chunk.startswith(b"--"):
                continue
            if chunk.startswith(b"\r\n"):
                chunk = chunk[2:]
            if chunk.endswith(b"\r\n"):
                chunk = chunk[:-2]
            header_blob, sep, data = chunk.partition(b"\r\n\r\n")
            if not sep:
                continue
            header = header_blob.decode("iso-8859-1", errors="replace")
            disposition = ""
            part_type = "application/octet-stream"
            for line in header.split("\r\n"):
                lower = line.lower()
                if lower.startswith("content-disposition:"):
                    disposition = line
                elif lower.startswith("content-type:"):
                    part_type = line.split(":", 1)[1].strip()
            name_match = re.search(r'name="([^"]*)"', disposition, re.I)
            name = name_match.group(1) if name_match else ""
            if name in ("file", "audio") or "filename=" in disposition.lower():
                if not data:
                    raise ValueError("empty audio")
                return data, part_type
        raise ValueError("audio file is missing")

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
                self._send_audio(cached_voice_audio(text))
            except NotConfiguredError:
                self._send(503, {"error": "ElevenLabs is not configured"})
            except VoiceServiceError:
                self._send(502, {"error": "ElevenLabs speech generation failed"})
        elif path == "/voice/transcribe":
            try:
                audio, content_type = self._read_audio_upload()
            except ValueError as exc:
                self._send(400, {"error": str(exc)})
                return
            try:
                text = transcribe(audio, allow_live=True, content_type=content_type)
            except NotConfiguredError:
                self._send(503, {"error": "ElevenLabs no está configurado"})
            except ValueError:
                self._send(400, {"error": "empty audio"})
            except VoiceServiceError:
                self._send(502, {"error": "ElevenLabs transcription failed"})
            else:
                self._send(200, {"text": text})
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
