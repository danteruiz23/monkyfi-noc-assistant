# Monkyfi NOC Assistant — web demo (`web/`)

Next.js (TypeScript) version of the NOC Assistant for the public demo link.
It uses **synthetic data only** and needs **no AI key and no ElevenLabs key**.
See `../docs/SPEC.md` for the plan (Block A, phases 1–4).

> Status: **phase 2** — screens 1–6 in EN/ES with a live replay, built on the
> deterministic logic ported in phase 1 (checked against Python). Questions, voice
> and guardrails (screen 7) arrive in phase 3; the guided demo and deploy in phase 4.

## Screens

The page is static (`/`, prerendered at build time). All logic runs in the
browser from the synthetic data in `data/`: no server calls, no keys.
Each screen has a link: `/#incidents`, `/#replay`, `/#detail`, `/#remediation`,
`/#summary`, `/#import`.

| # | Screen | What it shows |
|---|---|---|
| 1 | Incidents | Incidents with severity, devices, start, duration, alarm count and tickets. |
| 2 | Live replay | Plays the 50 simulator alarms in the browser at 30×/60×/120× (real gaps, scaled), with pause/resume and a live feed. |
| 3 | Incident detail | Probable cause, window, peaks, causal chain, affected customers, merged tickets and full timeline. |
| 4 | Remediation | Top runbook and an alternative, matched keywords, MTTR before/after; always "Recommendation: requires a NOC decision". |
| 5 | Closure summary | Editable draft (per incident and language), copy, export `.txt`, restore. |
| 6 | Import alarms | Paste or pick a `.txt` (same limits and filters as the backend); sample file; reset to demo data. |

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
| `components/` | `NocApp.tsx` (state, navigation, replay timer) and one file per screen in `screens/`. |
| `data/` | Copies of `../data/` (a test checks they stay identical). |
| `scripts/generate_fixtures.py` | Runs the real Python backend and writes `test/fixtures/`. |
| `test/` | Parity tests (TypeScript output must equal the Python output) and `i18n.test.ts` (EN/ES coverage, no hard-coded text in components, replay). |

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
