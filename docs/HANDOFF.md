# HANDOFF — Monkyfi NOC Assistant

**Phase:** Block A · Phase 1 — Scaffold and ported logic
**Date:** 23-nov-2026
**Status:** Done (PR open, not merged)
**Branch:** `noc-web-demo` · **PR:** https://github.com/danteruiz23/monkyfi-noc-assistant/pull/1

---

## a) Summary of tasks

- [x] Created branch `noc-web-demo` from `main`; saved `docs/SPEC.md` verbatim (commit `f7aded1`).
- [x] /prime check: Python backend run with `--load data/alerts.json` → main incident 44 events, 19.5 min, INC-1042/1043/1044.
- [x] `web/` Next.js 16.4.6 + React 19.3.1 + TypeScript 6.0.3 app (App Router), placeholder page in EN/ES.
- [x] Data copied to `web/data/` (test keeps them byte-identical to `data/`).
- [x] Python reference outputs generated with the **unchanged** backend → `web/test/fixtures/`.
- [x] Ported to TypeScript (`web/lib/`): syslog parser + import limits + suspicious-line filter, correlation, remediation, closure summary, question answers.
- [x] Parity tests (Vitest 5.1.0): 420 tests. Mutation check done (breaking float printing, tie rounding, Unicode `\b` or i/ı mapping makes tests fail).
- [x] Python backend still works (re-run after the work: same results; nothing under `backend/` changed).
- [x] Commit `8f00d33`, pushed, PR #1 opened (not merged).
- [ ] Not in phase 1 (by design): demo screens, live replay, voice, guardrails, deploy.

**Results (run at the end of the session, from `web/`):**
- `npm test` → 4 files, **420 passed**
- `npm run typecheck` → OK
- `npm run build` → compiled, `/` prerendered static
- `npm run fixtures:check` → fixtures are up to date
- `python3 backend/app.py --load data/alerts.json` (repo root) → INC-COPILOT-01: 44 events, 19.5, [INC-1042, INC-1043, INC-1044]
- Browser check (Playwright, `next start`): EN/ES toggle works, no horizontal scroll at 1280 px and 375 px.

---

## b) Next steps for the next session

1. Dante reviews PR #1 (and decides whether phase 2 continues on `noc-web-demo` or a new branch after merge).
2. **Phase 2 — Screens** (Sonnet 5.5): screens 1–6 of SPEC §3 in EN/ES, Monkyfi style (accent `#F5A9B8`), live replay of the 50 events in the browser.
   - Use `web/lib/` only (`import … from "@/lib"`); load JSON with `parsePyJson()`, print numbers with `pyStr()` / `pyFloatRepr()`.
   - For client-side replay, ship the raw JSON text and parse it with `parsePyJson()` in the browser (plain `JSON.parse` loses `12.0` → `12`).
   - Put every visible string in `web/lib/i18n.ts`; translate logic texts with `logicText()` (extend the map) — keep `web/lib/` output in English so parity stays exact.
   - Acceptance: every screen loads at 1280 and 375 px; no untranslated text.
3. Phase 3: reject impossible timestamps at import (see friction 3), ES answers, guardrails, browser voice.

**Prompt to start the next session (paste as is):**

> Repo danteruiz23/monkyfi-noc-assistant, branch `noc-web-demo`. Run /prime phase 2: read docs/SPEC.md and docs/HANDOFF.md, check the code in web/, run `cd web && npm ci && npm test && npm run build`, and give me a short brief. Do NOT write code until I say ok. Then build SPEC Block A phase 2 (screens 1–6, EN/ES, live replay), push and open a PR (do not merge). Rules: keep the Python backend working; synthetic data only, no secrets; public demo works with no AI key and no ElevenLabs key; every visible text in EN and ES. End with /hand-off.

---

## c) Friction points

1. **npm 10.9.9 crash** — `npm install` of Vitest fails with `Cannot read properties of null (reading 'edgesOut')` (npm bug in peer-dependency resolution; reproduced in an empty folder).
   Handled: lockfile created with `npx npm@11.6.2 install`; verified `npm ci` and `npm install` with npm 10 work from the lockfile.
   Unresolved: adding a *new* package with npm 10 may crash again → use `npx npm@11 install <pkg>`. For Vercel (phase 4) set the install command to `npm ci`.
2. **Python vs JavaScript text differences** — `12.0` prints as `12` in JS; `round(0.25, 1)` is `0.2` in Python; Python `splitlines`/`strip`/`len`/Unicode regex (`\b \w \s \d`, i/ı under IGNORECASE) differ from JS.
   Handled: `web/lib/py.ts` reproduces them; covered by fixtures + random corpus.
   Known limit: a JSON object whose only key is `"$float"` or `"$int"` would be misread by `parsePyJson()` (not in our data).
3. **Pre-existing Python behaviour (copied as is)** — an imported syslog line with an impossible date (e.g. month 13) passes the import regex, then `correlate()` raises; in Python every later `/incidents` call fails. TS throws `TimestampError` the same way.
   Unresolved: fix in phase 3 by rejecting such lines at import (in both Python and TS, then regenerate fixtures).
4. **File-writing tool turned ` ` escapes into real characters** in `web/lib/py.ts`, breaking a regex. Fixed; check for this if regexes with Unicode escapes are edited again.

---

## d) Changes in the plan

- No change to the SPEC scope. Small decisions within phase 1:
  - TypeScript **6.0.3**, not 7.x (7 is the new native compiler; risky with Next 16). Vitest **5.1.0** (5.1.1 was less than two weeks old).
  - Ported logic keeps **English** output to match Python exactly; ES is handled in the UI layer (`logicText()` in `web/lib/i18n.ts`). Full ES answers → phases 2–3.
  - The placeholder page shows the main incident (EN/ES) to prove the logic runs in the build; phase 2 replaces it.
  - Root `.gitignore` no longer ignores `docs/HANDOFF.md`, so the handoff lives in the repo as the rules require.
- `docs/SPEC.md` not modified.
- Open questions (SPEC §6, still pending Dante): public vs password link; browser voice vs ElevenLabs on the public link; AI provider for the pilot; commercial offer; first NMS. Plus: merge PR #1 before phase 2, or keep stacking on `noc-web-demo`?

---

## e) File paths

### Docs
- `docs/SPEC.md` — created: project SPEC (PRD, MVP, phases), verbatim.
- `docs/HANDOFF.md` — created: this handoff.
- `README.md` — modified: added "Web demo (in progress)" section pointing to `web/`.
- `web/README.md` — created: how to run, layout, parity workflow, npm note.

### Entry points (web app)
- `web/app/layout.tsx` — created: root layout, metadata (noindex).
- `web/app/page.tsx` — created: static page; correlates the demo data at build time.
- `web/app/globals.css` — created: base styles, accent `#F5A9B8`.
- `web/components/Overview.tsx` — created: client component, EN/ES toggle (saved in localStorage), main incident cards, footer disclaimer.

### Ported logic (`web/lib/`)
- `web/lib/index.ts` — created: public exports of the logic.
- `web/lib/types.ts` — created: `AlertEvent`, `Incident`, `Runbook`, `Suggestion` (snake_case like the Python API).
- `web/lib/py.ts` — created: Python behaviours (`PyFloat`, `pyFloatRepr`, `pyStr`, `pyRound`, `pySplitlines`, `pyStrip`, `pyLen`, `pyRegex`, `pyFold`, `parsePyJson`, int/float parsing).
- `web/lib/correlator.ts` — created: port of `backend/correlator.py` + strptime emulation (`parseTimestamp`, `TimestampError`).
- `web/lib/remediation.ts` — created: port of `backend/remediation.py`.
- `web/lib/summarizer.ts` — created: port of `backend/summarizer.py`.
- `web/lib/syslog.ts` — created: port of `parse_syslog_text`, `import_limit_error` and the `/alerts/import` checks (`importAlarmText`).
- `web/lib/answers.ts` — created: port of `voice_answer` (`answerQuestion`, fixed refusal/generic texts).
- `web/lib/data.ts` — created: server-only loader for `web/data/`.
- `web/lib/i18n.ts` — created: all UI strings EN/ES + `logicText()` for fixed logic texts.

### Configuration
- `web/package.json` — created: exact versions; scripts `dev`, `build`, `start`, `typecheck`, `test`, `fixtures`, `fixtures:check`.
- `web/package-lock.json` — created: lockfile (generated with npm 11.6.2).
- `web/tsconfig.json` — created: strict TS, `@/*` alias.
- `web/next.config.ts` — created: `reactStrictMode`, no `x-powered-by`.
- `web/vitest.config.mts` — created: Vitest config (node env, `@` alias).
- `web/.gitignore` — created: `node_modules/`, `.next/`, `next-env.d.ts`, `.env*`, etc.
- `.gitignore` — modified: removed the `docs/HANDOFF.md` line.
- Environment variables: none used by `web/` in phase 1. (Python backend still reads `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ANTHROPIC_API_KEY`; names only, see `.env.example`.)

### Tests and fixtures
- `web/scripts/generate_fixtures.py` — created: imports the real Python backend and writes the fixtures; `--check` mode.
- `web/test/helpers.ts` — created: fixture loading, type tagging, TS twin of `incident_bundle`.
- `web/test/numbers.test.ts` — created: float repr, rounding, splitlines/strip, timestamps.
- `web/test/correlation.test.ts` — created: SPEC acceptance (44 / 19.5 / INC-1042–1044), correlation/remediation/summary parity, data copies identical, EN/ES strings complete.
- `web/test/syslog.test.ts` — created: parsing parity, pipeline, 300-case random corpus, import limits, import checks.
- `web/test/answers.test.ts` — created: 650 questions × 4 states parity, 6 demo questions, refusals.
- `web/test/fixtures/incidents.json`, `web/test/fixtures/parse.json`, `web/test/fixtures/fuzz.json`, `web/test/fixtures/limits.json`, `web/test/fixtures/questions.json`, `web/test/fixtures/numbers.json` — created: Python reference outputs (generated, do not edit by hand).

### Data
- `web/data/alerts.json`, `web/data/runbooks.json`, `web/data/syslog.txt`, `web/data/alarmas-demo.txt` — created: copies of `data/` (synthetic).

### Not changed
- `backend/`, `data/`, `frontend/`, `simulator/` — untouched.

### Commands
```bash
# Web app (from web/)
cd web
npm ci
npm run dev              # http://localhost:3000
npm test                 # 420 parity tests
npm run typecheck
npm run build
npm run fixtures         # regenerate fixtures from Python
npm run fixtures:check   # fail if fixtures are stale

# Python backend (from repo root)
python3 backend/app.py --load data/alerts.json   # http://localhost:8000
```

---

## History
- 23-nov-2026 · Phase 1 (Scaffold and ported logic) · Done · PR #1 on `noc-web-demo`.
