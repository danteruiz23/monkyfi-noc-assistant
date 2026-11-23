# Monkyfi NOC Assistant — web demo (`web/`)

Next.js (TypeScript) version of the NOC Assistant for the public demo link.
It uses **synthetic data only** and needs **no AI key and no ElevenLabs key**.
See `../docs/SPEC.md` for the plan (Block A, phases 1–4).

> Status: **phase 4** — screens 1–7 in EN/ES, the guided demo ("Start demo",
> 5 steps), security headers and checks, Vercel config, the 5-minute demo
> script ([`DEMO.md`](DEMO.md), EN/ES) and the end-to-end check
> (`scripts/demo-check.js`). Built on the deterministic logic ported in phase 1
> (checked against Python).

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

## Guided demo (phase 4)

**Start demo** (top right, or the link `/#tour`) runs a 5-step tour in a panel
at the bottom of the window: 1. live replay (at 120×) → 2. incident detail →
3. remediation → 4. closure summary → 5. questions, where it asks "What is the
probable cause?" on its own. **Next** from step 1 jumps the replay to the end.
**Back**, **Exit demo** and Escape work at any step; the page behind stays
usable. Steps live in `lib/tour.ts`, texts in `lib/i18n.ts` (`tour*`).
The presenter's script is in [`DEMO.md`](DEMO.md).

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

## Deploy on Vercel

The public link is a Vercel project with **root directory `web`**. `vercel.json`
sets the framework (Next.js), `npm ci` and `npm run build`. Node comes from
`engines` (20.9 or newer).

1. Vercel → **Add New… → Project** → import `danteruiz23/monkyfi-noc-assistant`.
2. Project name `monkyfi-noc-assistant`; **Root Directory: `web`**; leave the
   build settings as detected (they come from `vercel.json`).
3. **Environment variables: none.** Do not set `VOICE_PROVIDER` or
   `ELEVENLABS_API_KEY` on the public project (voice stays in the browser, no cost).
4. Deploy. Then, from `web/`, run the check against the production link:
   `node scripts/demo-check.js --url https://<project>.vercel.app`
5. Optional but recommended: a Vercel Firewall rate-limit rule (see below).

Only `main` is the production branch; other branches get preview links.

## Security review (phase 4)

| Area | What is in place | Where |
|---|---|---|
| Headers | CSP (`default-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (microphone for this site only; camera, location, payment… off), HSTS 2 years, COOP/CORP same-origin; no `X-Powered-By`. | `lib/security-headers.ts`, `next.config.ts` |
| Call origin | API calls must come from this site: `Sec-Fetch-Site` must be `same-origin` (or `none`), `Origin` must match the host, `Origin: null` is refused; only `application/json` is accepted (a cross-site page would need a CORS preflight, which no route allows). | `lib/server/http.ts` → `sameOrigin()` |
| Client IP | On Vercel (`VERCEL=1`): `x-vercel-forwarded-for`, then `x-real-ip`, then `x-forwarded-for`; Vercel overwrites these, so a visitor cannot pick its own key. Off Vercel the headers are not trusted for security (local tests use them to act as several clients). The IP is only used as a SHA-256 hash. | `lib/server/http.ts` → `clientAddress()` |
| Limits | 500 characters per question; 1 MB + 64 KB per request (read as a stream); 20 questions/min and 300/h per client; ElevenLabs 10/min; function time cap 30 s. | `lib/server/ask.ts`, `lib/server/tts.ts`, `app/api/*/route.ts` |
| Content | Questions and alarm text are data, never instructions (guardrails, phase 3). No HTML from users is ever rendered. | `lib/guardrails.ts` |
| Secrets | None in the repo or in `vercel.json`; `.env*` is git-ignored except `.env.example` (names only). | `.gitignore`, `test/security.test.ts` |

**Limits across instances.** The counts are in memory, per server instance, so on
Vercel they are best effort. For the demo this is enough (no paid API is called).
To enforce one limit across instances without adding a database, add a Vercel
Firewall rule: **Firewall → Configure → New rule** "if Request Path starts with
`/api/` → Rate limit, fixed window 60 s, 30 requests, key IP, action Deny (429)".
A shared store (Upstash Redis / Vercel KV) is only needed if the pilot calls a
paid AI or voice API.

## Run

```bash
npm ci
npm run dev        # http://localhost:3000
npm test           # parity tests (Vitest)
npm run typecheck
npm run build
npm start          # production build on http://localhost:3000
npm run demo:check # end-to-end check against http://localhost:3000 (needs Playwright)
```

`scripts/demo-check.js --url <link>` checks a deployed link: headers and API
checks, 7 screens in EN/ES at 1280 and 375 px with no horizontal scroll and no
untranslated text, the main incident facts, the 5-step tour, the 6 demo
questions, a bad-date import, 3 off-topic strikes, and no console errors (a CSP
violation would show up there). `--shots <dir>` saves screenshots.

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
| `lib/tour.ts` | The 5 steps of the guided demo. |
| `lib/security-headers.ts` | CSP and the other security headers. |
| `scripts/demo-check.js` | End-to-end check of a running link (Playwright). |
| `vercel.json` | Vercel build settings (no environment variables). |
| `DEMO.md` | 5-minute demo script, EN and ES. |
| `test/` | Parity tests (TypeScript output must equal the Python output), `i18n.test.ts` (EN/ES coverage, no hard-coded text in components, replay) `security.test.ts` (headers, client IP, origin, tour, deploy config) and `guardrails.test.ts` with the battery in `guardrail-probes.ts` (71 probes × EN/ES, 5 multi-turn sequences, route, limits, log, ElevenLabs mocked). |

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
