# HANDOFF — Monkyfi NOC Assistant

**Phase:** Block A · Phase 2 — Screens
**Date:** 23-nov-2026
**Status:** Done (PR open, not merged)
**Branch:** `claude/loving-ritchie-cwuqj6` (based on `noc-web-demo` @ `9e519bc`) · **PR:** https://github.com/danteruiz23/monkyfi-noc-assistant/pull/2 (base `main`)

---

## a) Summary of tasks

- [x] /prime phase 2: read SPEC and phase 1 HANDOFF; `npm ci && npm test && npm run build` green (420 tests) before any change. Found PR #1 already merged into `main`.
- [x] Screen 1 — Incident panel: severity, devices, start, duration, alarm count, tickets; stats (alarms, incidents, tickets, alarms per incident).
- [x] Screen 2 — Live replay: the 50 simulator alarms in the browser, real gaps scaled at 30×/60×/120× (clamped 120–2500 ms), play/pause/resume/restart, progress, network clock, live feed, incidents forming live; banner on other screens while it runs.
- [x] Screen 3 — Incident detail: probable cause, window, peaks (97% / 12.0%), causal chain (BGP flap → saturation → packet loss → customer impact), affected customers, merged tickets with their history, full timeline.
- [x] Screen 4 — Remediation: top runbook + alternative, matched keywords, MTTR before/after with bars and % saved, fixed note "Recommendation: requires a NOC decision".
- [x] Screen 5 — Closure summary: editable draft (per incident + language + alarm count), copy (clipboard + fallback), export `.txt`, restore draft.
- [x] Screen 6 — Import alarms: paste or `.txt` file (size checked before reading), sample file, reset to demo data; same limits/filters as the backend; impossible dates refused in the UI.
- [x] EN/ES everywhere: all UI strings in `web/lib/i18n.ts`; Spanish for alarm messages, titles, runbooks, import errors and the closure summary (`web/lib/localize.ts`). English logic output unchanged (parity intact).
- [x] Screen links by hash: `/#incidents`, `/#replay`, `/#detail`, `/#remediation`, `/#summary`, `/#import`.
- [x] Python backend untouched and still works.
- [x] Commit `6eca1d8` pushed; PR #2 opened (not merged).
- [ ] Not in phase 2 (by design): screen 7 (questions + voice), guardrails, guided demo, deploy.

**Results (run at the end of the session):**
- `cd web && npm test` → 5 files, **447 passed** (420 parity + 27 new in `test/i18n.test.ts`)
- `cd web && npm run typecheck` → OK
- `cd web && npm run build` → compiled; `/` prerendered static
- `cd web && npm run fixtures:check` → fixtures are up to date
- `python3 backend/app.py --port 8123 --load data/alerts.json` + `GET /incidents` → INC-COPILOT-01, 44, 19.5, [INC-1042, INC-1043, INC-1044]
- Playwright on `next start` (script kept in the session scratchpad, not in the repo): 6 screens × EN/ES × 1280/375 px → no horizontal scroll, no English UI words in ES, no console errors. Replay → "50 alarms became 2 incidents", 19.5 min, INC-1042–1044; sample import → 55 alarms / 3 incidents; month-13 line refused; copy and export OK.

---

## b) Next steps for the next session

1. Dante reviews PR #2 (screens, Spanish wording, design) and merges it, or asks for changes.
2. **Phase 3 — Questions, voice and guardrails** (Opus 5.5), SPEC §5:
   - Screen 7 (questions): server route for questions using `answerQuestion()` from `web/lib/answers.ts`; Spanish answers (phase 1 logic answers in English; add Spanish like `lib/localize.ts`, keeping English parity).
   - Browser dictation (`SpeechRecognition`) and read-aloud (`speechSynthesis`); ElevenLabs only behind an env variable, off by default.
   - Monkyfi guardrails: fixed texts, warning and log at the 3rd attempt, rate limit, max size, pasted content treated as data; guardrail test suite.
   - Fix friction 3 of phase 1 at the source: reject impossible timestamps at import in Python **and** TS, then `npm run fixtures`. The UI guard in `ImportAlarms.tsx` can stay as defence in depth.
   - Put every new text in `web/lib/i18n.ts`; `test/i18n.test.ts` fails on hard-coded JSX text.
3. Phase 4: guided tour, Vercel deploy (install command `npm ci`, root `web`), `DEMO.md`, `demo-check.js` (reuse the Playwright checks described above), security review.

**Prompt to start the next session (paste as is):**

> Repo danteruiz23/monkyfi-noc-assistant, branch `main` (after PR #2 is merged; otherwise branch `claude/loving-ritchie-cwuqj6`). Run /prime phase 3: read docs/SPEC.md and docs/HANDOFF.md, check the code in web/, run `cd web && npm ci && npm test && npm run build`, and give me a short brief. Do NOT write code until I say ok. Then build SPEC Block A phase 3 (questions screen, browser voice, ElevenLabs optional by env variable, Monkyfi guardrails with tests, reject impossible timestamps at import in Python and TS), push and open a PR (do not merge). Rules: keep the Python backend working; synthetic data only, no secrets; public demo works with no AI key and no ElevenLabs key; every visible text in EN and ES. End with /hand-off.

---

## c) Friction points

1. **Session branch vs. requested branch** — the request said `noc-web-demo`, but this session can only push to `claude/loving-ritchie-cwuqj6`.
   Handled: the session branch was reset to `origin/noc-web-demo` (`9e519bc`, same tree as `main` after the PR #1 merge) and the PR targets `main`.
   Unresolved: `noc-web-demo` is now behind; delete it or fast-forward it after merging PR #2.
2. **Stale `next start` process** — `pkill -f "next start"` did not stop the `next-server` child; after a rebuild the old server served a stale build and a Playwright check timed out.
   Handled: kill with `pkill -f next-server` before restarting. Note for `demo-check.js` in phase 4.
3. **False positives in text checks** — a plain regex scan of the components flagged code as visible text, and the ES check flagged "Resume" inside "Resumen".
   Handled: the component scan uses the TypeScript parser (`JsxText` nodes and text attributes); the browser check matches whole words. A mutation check (adding `<em title="Hello">Decide now</em>`) made the test fail as expected.
4. **Incident ids shift after an import** — `correlate()` sorts by time, so the sample file (2-nov) becomes `INC-COPILOT-01` and the demo incident becomes `02`. This is the same as the Python backend (not a bug), but it can surprise during a demo. The UI falls back to the first incident when the selected id disappears.

---

## d) Changes in the plan

- No change to SPEC scope; `docs/SPEC.md` not modified.
- Decisions within phase 2:
  - **No server round-trips:** all screens run the ported logic in the browser from raw data text parsed with `parsePyJson()`. The question route (server) stays for phase 3.
  - **Alarm messages translated in ES** by pattern (`lib/localize.ts`), keeping identifiers and numbers. Unknown messages (other imports) are shown as received (device data).
  - **Decimal point kept in ES** (19.5, 12.0%) so numbers match the parity output and the tickets.
  - **Replay starts from zero and clears imports**; an import or "reset" ends a running replay so it cannot overwrite data.
  - "Tickets received" (not "merged") in the panel stat, because INC-1045 is not a duplicate.
  - PR base is `main` (PR #1 was already merged there).
- Open questions (still pending Dante): SPEC §6 items 1–5 (public vs password link; browser voice vs ElevenLabs; AI provider for the pilot; commercial offer; first NMS). Plus: delete or update `noc-web-demo`?

---

## e) File paths

### Entry points (web app)
- `web/app/page.tsx` — modified: static page; passes raw data text to `NocApp`.
- `web/app/globals.css` — modified: full Monkyfi dark style (accent `#F5A9B8`), tabs, cards, badges, replay, chain, MTTR bars, responsive rules for 900 and 520 px.
- `web/components/NocApp.tsx` — created: app shell; language, hash navigation, shared state (events, selected incident, drafts, import), replay timer.
- `web/components/ui.tsx` — created: shared pieces (severity/type badges, stat, empty state, NOC-decision note, incident picker, `IdList`).
- `web/components/Overview.tsx` — deleted: phase 1 placeholder.

### Screens
- `web/components/screens/IncidentPanel.tsx` — created: screen 1.
- `web/components/screens/LiveReplay.tsx` — created: screen 2.
- `web/components/screens/IncidentDetail.tsx` — created: screen 3.
- `web/components/screens/Remediation.tsx` — created: screen 4.
- `web/components/screens/ClosureSummary.tsx` — created: screen 5.
- `web/components/screens/ImportAlarms.tsx` — created: screen 6.

### Logic and texts (`web/lib/`)
- `web/lib/i18n.ts` — modified: all screen strings EN/ES, `fmt()`, `hasLogicText()`, Spanish for runbooks and import errors.
- `web/lib/localize.ts` — created: ES alarm messages and titles, severity/type keys, causal chain, ES remediation text and closure summary, MTTR saving.
- `web/lib/replay.ts` — created: replay order, speeds, scaled/clamped delays.
- `web/lib/data.ts` — modified: added `loadRawData()` (raw text for the browser).

### Configuration and environment
- No configuration or dependency changes (`web/package.json` and `web/package-lock.json` unchanged).
- Environment variables: none used by `web/`.

### Tests
- `web/test/i18n.test.ts` — created: 27 tests (EN/ES keys and placeholders, ES differs from EN, no hard-coded JSX text via the TypeScript parser, ES coverage of all demo/sample messages, runbooks and import errors, EN summary equals `draftSummary()`, ES summary keeps the same facts, causal chain, MTTR, replay order/partial correlation/timing).

### Docs
- `web/README.md` — modified: phase 2 status, screens table, layout.
- `docs/HANDOFF.md` — modified: this handoff.

### Not changed
- `backend/`, `data/`, `frontend/`, `simulator/`, `web/data/`, `web/test/fixtures/`, `docs/SPEC.md`.

### Commands
```bash
# Web app (from web/)
cd web
npm ci
npm run dev              # http://localhost:3000  (screens: /#incidents ... /#import)
npm test                 # 447 tests
npm run typecheck
npm run build
npm start                # serve the production build
npm run fixtures:check   # fail if fixtures are stale

# Python backend (from repo root)
python3 backend/app.py --load data/alerts.json   # http://localhost:8000
```

---

## History
- 23-nov-2026 · Phase 1 (Scaffold and ported logic) · Done · PR #1 on `noc-web-demo` (merged into `main`).
- 23-nov-2026 · Phase 2 (Screens 1–6, EN/ES, live replay) · Done · PR #2 from `claude/loving-ritchie-cwuqj6` to `main`.
