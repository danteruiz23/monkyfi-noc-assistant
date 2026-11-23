# Monkyfi NOC Assistant — web demo (`web/`)

Next.js (TypeScript) version of the NOC Assistant for the public demo link.
It uses **synthetic data only** and needs **no AI key and no ElevenLabs key**.
See `../docs/SPEC.md` for the plan (Block A, phases 1–4).

> Status: **phase 3** — screens 1–7 in EN/ES: live replay, questions with
> browser voice, and the Monkyfi guardrails on a server route. Built on the
> deterministic logic ported in phase 1 (checked against Python). The guided
> demo and the deploy arrive in phase 4.

## Screens

The page is static (`/`, prerendered at build time). Screens 1–6 run the
logic in the browser from the synthetic data in `data/`. Screen 7 asks the
server route `POST /api/ask`, which applies the guardrails. No keys are needed.
Each screen has a link: `/#incidents`, `/#replay`, `/#detail`, `/#remediation`,
`/#summary`, `/#import`, `/#ask`.

| # | Screen | What it shows |
|---|---|---|
| 1 | Incidents | Incidents with severity, devices, start, duration, alarm count and tickets. |
| 2 | Live replay | Plays the 50 simulator alarms in the browser at 30×/60×/120× (real gaps, scaled), with pause/resume and a live feed. |
| 3 | Incident detail | Probable cause, window, peaks, causal chain, affected customers, merged tickets and full timeline. |
| 4 | Remediation | Top runbook and an alternative, matched keywords, MTTR before/after; always "Recommendation: requires a NOC decision". |
| 5 | Closure summary | Editable draft (per incident and language), copy, export `.txt`, restore. |
| 6 | Import alarms | Paste or pick a `.txt` (same limits and filters as the backend; lines with an impossible date are ignored); sample file; reset to demo data. |
| 7 | Questions | Six demo questions, a text box, browser dictation and read-aloud; answers in EN/ES from the alarms on screen; fixed replies for anything else. |

## Questions, voice and guardrails (phase 3)

- `POST /api/ask` `{ question, lang, data: { demo, imported } }` rebuilds the
  alarms the browser shows (replay prefix + imported syslog lines, re-parsed with
  the same limits) and answers from them. English answers are the parity-tested
  text (`answerQuestion()`); Spanish states the same facts (`lib/localize.ts`).
- **Guardrails** (`lib/guardrails.ts`, Monkyfi standard): each question is
  classified (`on_topic`, `off_topic`, `about_agent`, `manipulation`) before any
  answer. Off-topic and manipulation get a fixed text that never lists rules;
  each one is a strike, logged with a redacted excerpt and a hashed client id;
  from the 3rd strike the reply says it was reported and the log line is a
  `guardrail_report`. "What can you do?" is not a strike. Commands ("reboot
  MIA-EDGE-02") get the human-control text: the assistant recommends, the NOC
  decides. Pasted alarm lines are data, never obeyed and never a strike.
- **Limits**: 500 characters per question, 1 MB + 64 KB per request, 20
  questions per minute and 300 per hour per client, same-origin only. Counts are
  in memory, so on serverless hosting they are per instance (best effort).
- **Voice**: dictation (`SpeechRecognition`) and read-aloud (`speechSynthesis`)
  are the browser's own, with no cost and no key. Where the browser has no
  dictation (e.g. Firefox), the screen says so and typing still works.
- **ElevenLabs (optional)**: off unless `VOICE_PROVIDER=elevenlabs` **and**
  `ELEVENLABS_API_KEY` are set on the server (see `.env.example`). Then
  `POST /api/tts` speaks the assistant's own answer (rebuilt from the
  question, never arbitrary text), with a 10-per-minute limit and a cache;
  refusals are not sent to ElevenLabs. If it fails, the browser voice reads.

Languages: the EN/ES toggle is remembered in the browser. English texts that
come from the logic (titles, summary, remediation) are exactly the
parity-tested output; Spanish is built from the same values in `lib/localize.ts`.

## Run

```bash
npm ci
npm run dev        # http://localhost:3000
npm test           # parity tests (Vitest)
npm run typecheck
npm run build
```

Node 20.9 or newer. Use `npm ci` (the lockfile is committed). Note: `npm install`
of a *new* package with npm 10.9 can crash on Vitest's peer dependencies
("Cannot read properties of null (reading 'edgesOut')"); npm 11 works
(`npx npm@11 install <pkg>`).

## Layout

| Path | What it is |
|---|---|
| `lib/` | Ported logic: `syslog.ts` (import, limits, filters), `correlator.ts`, `remediation.ts`, `summarizer.ts`, `answers.ts` (question answers). No I/O, safe in the browser. |
| `lib/py.ts` | Helpers that reproduce Python behaviour the text depends on (float printing, `round`, `splitlines`, Unicode regex rules). |
| `lib/data.ts` | Server-only loader for `data/`. |
| `lib/i18n.ts` | Every visible text, EN and ES, plus Spanish for the fixed logic texts (causes, runbooks, import errors). |
| `lib/localize.ts` | Spanish views of the logic output: alarm messages, incident titles, causal chain, closure summary. |
| `lib/replay.ts` | Live replay order and timing. |
| `lib/guardrails.ts` | Question classification, fixed replies, strike counter, rate limiter, redacted log lines. |
| `lib/voice.ts` | Browser dictation and read-aloud helpers. |
| `lib/server/` | Server-only: `ask.ts` (`/api/ask`), `tts.ts` (optional ElevenLabs), `http.ts` (origin, size, client key). |
| `app/api/` | Route files for `/api/ask` and `/api/tts`. |
| `components/` | `NocApp.tsx` (state, navigation, replay timer) and one file per screen in `screens/`. |
| `data/` | Copies of `../data/` (a test checks they stay identical). |
| `scripts/generate_fixtures.py` | Runs the real Python backend and writes `test/fixtures/`. |
| `test/` | Parity tests (TypeScript output must equal the Python output), `i18n.test.ts` (EN/ES coverage, no hard-coded text in components, replay) and `guardrails.test.ts` with the battery in `guardrail-probes.ts` (71 probes × EN/ES, 5 multi-turn sequences, route, limits, log, ElevenLabs mocked). |

## Parity with Python

The Python backend (`../backend/`) stays the reference. When it changes:

```bash
npm run fixtures         # regenerate test/fixtures/ from Python
npm test
npm run fixtures:check   # fails if the fixtures are out of date
```

The fixtures cover the demo data, the syslog files, 300 random syslog blocks,
the import limits, and 650 questions (EN, ES, off-topic, manipulative and
Unicode edge cases) in four data states.

Two Python details matter for the visible text:

- A float such as `12.0` prints as `12.0` in Python and `12` in JavaScript.
  Load JSON with `parsePyJson()` (not `JSON.parse`) and print numbers with
  `pyStr()` / `pyFloatRepr()`.
- `round(0.25, 1)` is `0.2` in Python; `pyRound()` does the same.
