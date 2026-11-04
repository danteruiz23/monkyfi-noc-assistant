# Monkyfi NOC Assistant

A local NOC incident assistant for ingesting alerts, correlating incidents, surfacing runbook-based remediation, drafting closure summaries, and reading answers aloud with ElevenLabs.

## Features

- Live incident panel with timelines, remediation guidance, and ticket summaries.
- Automatic refresh and manual refresh controls.
- English/Spanish interface labels and browser-based voice dictation.
- Paste simulator-style syslog alarms or import a `.txt` file for analysis.
- Voice answers using ElevenLabs text-to-speech.
- Python standard library backend; no extra pip dependencies.

## Run locally

From the repository root:

```bash
python3 backend/app.py --load data/alerts.json
```

Open <http://localhost:8000/>. `--load` already contains the full demo arc. Streaming the simulator on top of that load repeats every alert. To replay the arc into an empty backend, start `python3 backend/app.py` with no `--load`, then run this in a second terminal:

```bash
python3 simulator/noc_simulator.py --stream --webhook http://localhost:8000/webhook
```

To try the alarm importer, select `data/alarmas-demo.txt` in the panel. Imported lines must use the simulator-style syslog format found in `data/syslog.txt`.

## Demo (3 minutos)

1. In the terminal where `ELEVENLABS_API_KEY` is exported, start an empty backend:

```bash
python3 backend/app.py
```

2. In a second terminal, run the simulator once:

```bash
python3 simulator/noc_simulator.py --stream --webhook http://localhost:8000/webhook
```

3. Open <http://localhost:8000/>. The main incident should show 44 events, 19.5 minutes, and tickets INC-1042, INC-1043, and INC-1044.

4. Ask link saturation, probable cause, and incident impact. Use the microphone to dictate, then press Play to hear the answer.

## ElevenLabs voice

Set `ELEVENLABS_API_KEY` in the environment of the terminal that starts the backend. Optionally set `ELEVENLABS_VOICE_ID` to choose a voice. Do not commit `.env` or API keys.

Example for one terminal session:

```bash
export ELEVENLABS_API_KEY="your-key"
python3 backend/app.py --load data/alerts.json
```

## Data and runbooks

`data/alerts.json` contains the demo alert events; `data/runbooks.json` contains the remediation examples; `data/syslog.txt` is the matching syslog representation. The panel's alarm import currently parses simulator-style syslog lines, not arbitrary free-form text.
