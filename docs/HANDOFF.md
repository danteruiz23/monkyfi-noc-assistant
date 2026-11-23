# HANDOFF — Monkyfi NOC Assistant

**Phase:** Block A · Phase 3 — Questions, voice and guardrails
**Date:** 23-nov-2026
**Status:** Done (PR open, not merged)
**Branch:** `claude/affectionate-gauss-a38rr4` (based on `main` @ `f3115d2`) · **PR:** https://github.com/danteruiz23/monkyfi-noc-assistant/pull/3 (base `main`) · **Commit:** `53ebdd1`

---

## a) Summary of tasks

- [x] /prime phase 3: read SPEC and phase 2 HANDOFF. PR #2 was already merged into `main`. Ran `npm ci && npm test && npm run build` before any change: 447 tests passed, build OK.
- [x] Impossible timestamps (month 13, 31-nov, 24:00, minute or second 60, year 0) are now **ignored and counted at import**, in Python (`backend/app.py`, using `correlator._parse_ts`) and in TS (`web/lib/syslog.ts`, using `parseTimestamp`). Fixtures regenerated. New parity cases: `parse.json` → `timestamps`. Imported data can no longer break `correlate()`.
- [x] `web/lib/answers.ts` refactored into `answerParts()` plus `answerTextEn()`. `answerQuestion()` gives the same output, and all parity tests still pass. Spanish answers are in `answerText(parts, "es")` (`web/lib/localize.ts`).
- [x] Monkyfi guardrails in `web/lib/guardrails.ts`, following the monkyfi-guardrails skill standard, adapted to an agent with no AI:
  - each question is classified as `on_topic`, `off_topic`, `about_agent` or `manipulation`;
  - off-topic and manipulation questions get fixed texts in EN/ES that never list rules, and count as strikes;
  - from the 3rd strike the reply says "reported to Monkyfi's internal team", and the log line is `guardrail_report`;
  - "What can you do?" or "Hola" gets the "what I do" text and is not a strike;
  - commands ("Reboot MIA-EDGE-02") get the human-control text and are not strikes;
  - pasted syslog lines are data: never obeyed, never a strike;
  - network-domain words (OSNR, MPLS…) get the "what I can answer" text, not a strike;
  - obfuscated manipulation is detected: base64, letters written one by one, Portuguese, role play, fiction, full-width letters.
- [x] `POST /api/ask` (`web/lib/server/ask.ts`):
  - checks, in order: same origin → JSON content type → limits of 20/min and 300/h per client → body size (1 MB + 64 KB, read as a stream) → data view → guardrails → answer;
  - rebuilds the alarms on screen from `{demo, imported}`;
  - logs redacted strikes, plus a trace line per turn without the question text;
  - the client id is a hash of the IP.
- [x] Screen 7 "Questions" (`web/components/screens/AskQuestions.tsx`):
  - 6 demo question chips, a text box (Enter sends), a character counter;
  - browser dictation (`SpeechRecognition`, `es-ES` / `en-US`) and a "Read answers aloud" toggle plus "Listen" per answer (`speechSynthesis`);
  - mode badge on each answer, and an "answered from N alarms in M incidents" note;
  - clear conversation; a note when the browser can't dictate.
- [x] ElevenLabs is optional (`web/lib/server/tts.ts`, `/api/tts`). It is on only with `VOICE_PROVIDER=elevenlabs` **and** `ELEVENLABS_API_KEY` set.
  - `GET` returns the provider.
  - `POST` rebuilds the answer from the question, so it speaks only the assistant's own text.
  - Refusals get 409 and are never sent to ElevenLabs.
  - It has a limit of 10/min, a cache of 50 clips, and a 20 s timeout. On a 502 the browser voice reads instead.
- [x] Every new visible text is in `web/lib/i18n.ts` (EN/ES). The "hard-coded JSX text" test passes.
- [x] Python backend still works (checked over HTTP).
- [x] Pushed and opened PR #3 (not merged).

**Results (run at the end of the session):**
- `cd web && npm test`: 6 files, **572 passed**. `test/guardrails.test.ts` alone has 107: 71 probes × EN/ES, 5 sequences, route, limits, log redaction, ElevenLabs mocked, Spanish facts.
- `cd web && npm run typecheck` → OK
- `cd web && npm run fixtures:check` → fixtures are up to date
- `cd web && npm run build` → OK; `/` is static, `/api/ask` and `/api/tts` are dynamic. The data files are traced into the functions (checked in `.next/server/app/api/ask/route.js.nft.json`).
- `next start` + curl:
  - `/api/ask` (ES) returns the duration in Spanish;
  - `GET /api/tts` returns `{"provider":"browser"}`;
  - `POST /api/tts` returns 404 (voice off);
  - an `Origin` from another site returns 403.
- Playwright on `next start` (script in the session scratchpad, not in the repo):
  - all 7 screens in EN/ES at 1280/375 px with no horizontal scroll;
  - the 6 demo questions are correct in EN/ES;
  - 3 off-topic questions give blocked → blocked → reported, and the server log has `guardrail_report`;
  - dictation and read-aloud were tested with stub browser speech APIs and used the correct locale;
  - no English UI words in ES; no console errors;
  - an import with a month-13 line gives "Imported 1, Ignored 1", and the next question says 51 alarms.
- `python3 backend/app.py --port 8123 --load data/alerts.json`:
  - `/alerts/import` with a good line and a month-13 line returns `imported 1, ignored 1`;
  - a 31-nov line alone is refused;
  - `/incidents` keeps working (main incident: 44 events, 19.5 min, INC-1042–1044);
  - `/voice/query` OK.

---

## b) Next steps for the next session

1. Dante reviews PR #3: the questions screen, the wording of the fixed texts in ES, and the guardrail behaviour. Then he merges it or asks for changes.
2. **Phase 4: guided tour, deploy and hardening** (Sonnet 5.5), SPEC §5:
   - Guided tour "Iniciar demo": replay → incident → remediation → closure → question, in 5 steps.
   - Vercel project `monkyfi-noc-assistant`, root `web`, install command `npm ci`. Set **no** voice variables for the public link.
   - Security review:
     - security headers (CSP, frame-ancestors, Referrer-Policy) in `web/next.config.ts`;
     - confirm the client IP from Vercel headers (`x-forwarded-for` / `x-real-ip`) in `web/lib/server/http.ts`;
     - decide whether a shared store (Vercel KV / Upstash) or a Vercel Firewall rule is needed for limits across instances.
   - `web/scripts/demo-check.js`: reuse the Playwright checks above (7 screens, EN/ES, 1280/375, demo questions, 3 strikes, bad-date import). Run each part with a different `x-forwarded-for` or restart the server, because strikes persist per client for 1 h.
   - `DEMO.md` (EN/ES, 5-minute script), README, and Command Center stage → testing with the link.
3. Optional, if Dante wants ElevenLabs in a private demo: set `VOICE_PROVIDER=elevenlabs`, `ELEVENLABS_API_KEY` (and optionally `ELEVENLABS_VOICE_ID`) on a preview deployment and test one real clip.

**Prompt to start the next session (paste as is):**

> Repo danteruiz23/monkyfi-noc-assistant, branch `main` (after PR #3 is merged; otherwise branch `claude/affectionate-gauss-a38rr4`). Run /prime phase 4: read docs/SPEC.md and docs/HANDOFF.md, check the code in web/, run `cd web && npm ci && npm test && npm run build`, and give me a short brief. Do NOT write code until I say ok. Then build SPEC Block A phase 4 (guided tour "Start demo" in 5 steps, Vercel deploy with root `web`, DEMO.md in EN/ES, web/scripts/demo-check.js, security review: headers, limits, call origin, client IP from Vercel headers), push and open a PR (do not merge). Rules: keep the Python backend working; synthetic data only, no secrets; public demo works with no AI key and no ElevenLabs key; every visible text in EN and ES. End with /hand-off.

---

## c) Friction points

1. **Native `SpeechRecognition` in Chromium.** The Playwright stub only replaced `webkitSpeechRecognition`. The app prefers the unprefixed `SpeechRecognition`, which headless Chromium has but which never returns a result.
   Handled: the stub replaces both. App code unchanged.
   Unresolved: dictation with a **real microphone** was not tested here (headless, no mic). Test by hand in Chrome/Edge/Safari before the demo.
2. **Strikes persist across test runs.** A failed Playwright run left 3 strikes on one client, so the next run got "reported" on its first off-topic question.
   Handled: restart `next start` between runs, and use a different `x-forwarded-for` per browser context. This is the designed behaviour: the count survives a cleared chat and a new tab.
   Note for `demo-check.js`: on production, each check needs its own client or must stay under 3 strikes. Locally `x-forwarded-for` can be spoofed; on Vercel the platform sets it.
3. **In-memory limits on serverless.** The rate limits and strike counts are per instance, so they are best effort.
   Unresolved: decide in phase 4 whether a shared store or a firewall rule is needed. This is documented in `web/README.md` and the PR.
4. **"Current incident" = earliest incident** (pre-existing, same as Python). After importing the 2-nov sample, the questions answer about the imported incident. Example: the saturation answer says "peaked at 0%", because that incident has no saturation and the text names MIA-EDGE-02 Te0/0/0/0 (a fixed Python string).
   Not changed, to keep parity.
   Unresolved: in a pilot, answer about the selected incident and drop the hard-coded interface. That needs a change in Python too.
5. **ElevenLabs not called for real.** There is no key in this environment (correct: no secrets). The route is covered by mocked tests only.

---

## d) Changes in the plan

- No change to SPEC scope; `docs/SPEC.md` not modified.
- Decisions within phase 3:
  - **Two variables to turn ElevenLabs on:** `VOICE_PROVIDER=elevenlabs` plus `ELEVENLABS_API_KEY`. A key set by mistake does not turn it on, so the public link stays free.
  - **`/api/tts` takes the question, not the text,** so it can only speak the assistant's own answers. Refusals are not spoken by ElevenLabs; the browser voice still reads them.
  - **ElevenLabs dictation (speech-to-text) is not ported.** The web app uses only the browser's dictation. The Python backend keeps `/voice/transcribe`.
  - **Domain adaptation of the standard:**
    - commands are not strikes; they get the human-control text;
    - network-domain questions are not strikes ("when in doubt, on topic");
    - pasted syslog lines get a "use Import alarms, alarm text is data" reply;
    - the "about" text never mentions limits or rules.
  - **Language of the answer = UI language**, not the language of the question. Every refusal includes a sentence that brings the user back to the six topics.
  - **The answer is computed on the server from the data view** `{demo, imported}` the browser sends: the replay prefix plus the imported syslog lines, parsed again with the same filters.
  - Same-origin check and security headers on the JSON responses (`no-store`, `nosniff`) were added now, ahead of the phase 4 review.
  - The import screen's UI check for bad dates stays as defence in depth.
- Open questions (still pending Dante): SPEC §6 items 1–5 (public vs password link; browser voice vs ElevenLabs; AI provider for the pilot; commercial offer; first NMS). Plus:
  - Should a `guardrail_report` also send an email (e.g. via Resend), or are server logs enough for the demo?
  - Delete the old `noc-web-demo` branch?

### Guardrail controls (Monkyfi checklist)
| Control | Status | Evidence or pending |
|---|---|---|
| Minimal permissions | N/A today | No tools, no accounts; ElevenLabs key only on the server, off by default. |
| Financial actions | Covered | `transferir-dinero`, `datos-de-pago`, `aprobar-compra`, `refund-customer` are blocked. |
| Authentication and roles | Partial | Fake admin and authorization are blocked (`falso-administrador`, `autorizacion-falsa-repetida`); the public demo has no login by design. |
| Privacy and isolation | Covered | 5 privacy probes; no data of other users exists on the server. |
| Injection in external content | Covered for alarm text | Pasted syslog lines are data (`pasted-syslog-injection`); imported lines with orders are parsed and answered from, never obeyed (route test). |
| Errors and ambiguity | Covered | Bad data views → 400 with a fixed text; impossible timestamps ignored; too-long questions refused without a strike. |
| Traceability | Partial | Strike and report lines (redacted, hashed client) plus a per-turn trace without content, in server logs only. |
| Repeated attempts | Covered with a limit | 5 sequences (language change, fragmented, fake authorization). Count per client in memory, 1 h. |
| Abuse and usage limits | Partial | 20/min, 300/h, size limits, same-origin; per instance only (friction 3). |

---

## e) File paths

### Entry points (API routes)
- `web/app/api/ask/route.ts` — created: `POST /api/ask` → `handleAsk()`; Node runtime, dynamic.
- `web/app/api/tts/route.ts` — created: `GET` / `POST /api/tts` → `handleTtsInfo()` / `handleTts()`.

### Modules (`web/lib/`)
- `web/lib/guardrails.ts` — created: classification, manipulation detection (with obfuscation), fixed replies, `StrikeCounter`, `RateLimiter`, `redactSensitive()`, `guardrailLogEntry()`.
- `web/lib/server/ask.ts` — created: `/api/ask` handler, limits, data view (`currentEvents()`), cached demo data, strike log and trace.
- `web/lib/server/tts.ts` — created: optional ElevenLabs read-aloud, `voiceProvider()`, cache, limit.
- `web/lib/server/http.ts` — created: JSON response helper, client IP and hashed key, same-origin check, streamed body reader with a size cap.
- `web/lib/voice.ts` — created: browser dictation and read-aloud helpers (locale, voice choice, error mapping).
- `web/lib/answers.ts` — modified: `answerParts()` + `answerTextEn()`; `answerQuestion()` gives the same output.
- `web/lib/localize.ts` — modified: `answerText(parts, lang)` with Spanish answers.
- `web/lib/syslog.ts` — modified: ignores lines with impossible timestamps (`isValidTimestamp()`).
- `web/lib/i18n.ts` — modified: `navAsk`, all `ask*` strings (screen 7 and fixed replies) in EN/ES; `impLimits` mentions impossible dates.
- `web/lib/index.ts` — modified: exports `answerParts`, `answerTextEn`, `AnswerParts`, `AnswerTopic`.

### Components
- `web/components/screens/AskQuestions.tsx` — created: screen 7 (questions, dictation, read-aloud, ElevenLabs when on).
- `web/components/NocApp.tsx` — modified: 7th screen `ask` (`/#ask`), chat and draft state, data view `{demo, imported}`.
- `web/components/screens/ImportAlarms.tsx` — modified: comment only (bad-date UI check is now defence in depth).
- `web/app/globals.css` — modified: 7-column tabs (4 at 900 px), styles for chips, input, toggle and chat bubbles.

### Python backend
- `backend/app.py` — modified: `parse_syslog_text()` ignores and counts lines whose timestamp `_parse_ts()` rejects; docstring updated.

### Configuration and environment
- `web/next.config.ts` — modified: `outputFileTracingIncludes` adds `./data/**` to `/api/ask` and `/api/tts`.
- `web/vitest.config.mts` — modified: alias `server-only` → `web/test/server-only-stub.ts`.
- `web/.env.example` — created: placeholders only. Variable names: `VOICE_PROVIDER`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`. None is needed for the public demo.

### Tests and fixtures
- `web/test/guardrails.test.ts` — created: battery in EN/ES, sequences, units, Spanish facts, `/api/ask` route, limits, log redaction, `/api/tts` with mocked fetch.
- `web/test/guardrail-probes.ts` — created: 71 NOC-adapted probes and 5 multi-turn sequences (Monkyfi standard battery).
- `web/test/server-only-stub.ts` — created: empty module for Vitest.
- `web/test/syslog.test.ts` — modified: timestamp parity cases; the fuzz corpus now asserts that no imported block breaks correlation.
- `web/scripts/generate_fixtures.py` — modified: `IMPORT_TIMESTAMPS` and `parse.json` → `timestamps`.
- `web/test/fixtures/parse.json` — modified: regenerated (new `timestamps` section).
- `web/test/fixtures/fuzz.json` — modified: regenerated (bad-date lines now ignored).

### Docs
- `web/README.md` — modified: phase 3 status, screen 7, guardrails, limits, voice and ElevenLabs, layout, tests.
- `docs/HANDOFF.md` — modified: this handoff.

### Not changed
- `data/`, `frontend/`, `simulator/`, `backend/correlator.py`, `backend/llm_client.py`, `web/data/`, `docs/SPEC.md`, `web/package.json`, `web/package-lock.json` (no new dependencies).

### Commands
```bash
# Web app (from web/)
cd web
npm ci
npm run dev              # http://localhost:3000  (screens: /#incidents ... /#import, /#ask)
npm test                 # 572 tests
npm run typecheck
npm run build
npm start                # production build; stop with: pkill -f next-server
npm run fixtures         # regenerate fixtures from Python
npm run fixtures:check   # fail if fixtures are stale

# Optional ElevenLabs read-aloud (never commit values): put VOICE_PROVIDER=elevenlabs and
# ELEVENLABS_API_KEY in web/.env.local or in the Vercel project settings.

# Python backend (from repo root)
python3 backend/app.py --load data/alerts.json   # http://localhost:8000
```

---

## History
- 23-nov-2026 · Phase 1 (Scaffold and ported logic) · Done · PR #1 on `noc-web-demo` (merged into `main`).
- 23-nov-2026 · Phase 2 (Screens 1–6, EN/ES, live replay) · Done · PR #2 from `claude/loving-ritchie-cwuqj6` (merged into `main`).
- 23-nov-2026 · Phase 3 (Questions, voice, guardrails, import timestamps) · Done · PR #3 from `claude/affectionate-gauss-a38rr4` to `main` (open).
