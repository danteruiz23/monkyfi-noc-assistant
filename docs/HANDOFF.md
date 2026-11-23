# HANDOFF — Monkyfi NOC Assistant

**Phase:** Block A · Phase 4 — Guided demo, deploy and hardening
**Date:** 23-nov-2026
**Status:** Done. PR #4 is merged. Production: **https://monkyfi-noc-assistant.vercel.app**. `demo-check.js` on production: **29/29** (23-nov-2026).
**Branch:** `claude/zealous-bell-gd6cp7` (based on `main` @ `6ff3044`) · **PR:** https://github.com/danteruiz23/monkyfi-noc-assistant/pull/4 (base `main`) · **Commit:** `68edbae`

---

## a) Summary of tasks

- [x] /prime phase 4: PR #3 was already merged; `npm ci && npm test && npm run build` → 572 passed, build OK, before any change.
- [x] **Guided tour** "Start demo" / "Iniciar demo":
  - 5 steps: replay (at 120×) → incident detail → remediation → closure → questions;
  - step 5 asks "What is the probable cause?" on its own;
  - Next from step 1 jumps the replay to the end;
  - Back, Exit and Escape work at every step, and the page behind stays usable;
  - the `/#tour` link starts the tour;
  - new answers scroll into view above the tour panel (mobile).
- [x] **Security review:**
  - headers (CSP, frame-ancestors, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS, COOP/CORP);
  - origin of the calls: `Sec-Fetch-Site` plus `Origin`, and `Origin: null` is refused;
  - client IP from Vercel headers (`x-vercel-forwarded-for` → `x-real-ip` → `x-forwarded-for`, only when `VERCEL=1`);
  - `maxDuration = 30` on the API routes;
  - limits unchanged, and the cross-instance option is documented (Vercel Firewall rule).
- [x] `web/vercel.json`: Next.js, `npm ci`, `npm run build`, no environment variables.
- [x] `web/scripts/demo-check.js` (Playwright, `--url`, `--shots`, `--pace`), run with `npm run demo:check`.
- [x] `web/DEMO.md`: a 5-minute script in EN and ES, a checklist before the call, likely questions, and a fallback plan.
- [x] `web/README.md` (tour, deploy, security review, layout) and the root `README.md` are updated.
- [x] Python backend still works.
- [x] Pushed, and opened PR #4 (not merged).
- [x] **Vercel deploy.** Done by Dante (the Vercel connector here cannot create projects): https://monkyfi-noc-assistant.vercel.app
- [x] **`demo-check.js` on production:** `NODE_USE_ENV_PROXY=1 node scripts/demo-check.js --url https://monkyfi-noc-assistant.vercel.app` → **29/29 passed** (77 s). This covers EN/ES at 1280/375 px, the tour, the 6 questions, the import, the 3 strikes and the headers.
  - `NODE_USE_ENV_PROXY=1` is only needed in Claude Code cloud sessions: Node's `fetch` there ignores the session proxy. Without it the 6 HTTP checks fail with "fetch failed". On a Mac, run the command without it.
  - The cloud session runs in a personal environment, `monkyfi-noc-assistant`, which only allows `monkyfi-noc-assistant.vercel.app`.
- [ ] **Command Center stage** (development → testing, with the link). Pending: Dante.

**Results (run at the end of the session):**
- `cd web && npm test`: 7 files, **588 passed** (+16 in `test/security.test.ts`).
- `cd web && npm run typecheck` → OK.
- `cd web && npm run fixtures:check` → fixtures are up to date.
- `cd web && npm run build` → OK; `/` is static, `/api/ask` and `/api/tts` are dynamic.
- `cd web && npx next start -p 3100`, then `node scripts/demo-check.js --url http://localhost:3100` → **29/29 passed** (about 9 s).
- `node scripts/demo-check.js --url http://0.0.0.0:3100` (remote mode: one shared client, 3.5 s between questions) → **29/29**, twice (about 77 s). The second run gave reported → reported → reported, which is accepted as designed.
- `next dev`: the tour runs to step 5 with **0 console errors** under the dev CSP.
- `python3 backend/app.py --port 8123 --load data/alerts.json` → `/incidents` main incident: 44 events, 19.5 min, `['INC-1042', 'INC-1043', 'INC-1044']`.

---

## b) Next steps for the next session

1. Done: deploy and production check (29/29).
2. Command Center: move NOC Assistant from development to testing, with https://monkyfi-noc-assistant.vercel.app
3. Optional: add the Vercel Firewall rule (`/api/` → rate limit 30 per 60 s per IP → 429), as described in the README.
4. Test dictation with a real microphone in Chrome or Edge (steps 2–3 in `web/DEMO.md`).
6. Rehearse `web/DEMO.md` once (5 min), in EN and ES.
7. After that: Block B (phase 5, real alarm intake), once Dante answers the SPEC §6 open questions.

**Prompt to start the next session (paste as is):**

> Repo danteruiz23/monkyfi-noc-assistant, branch `main` (after PR #4 is merged; otherwise branch `claude/zealous-bell-gd6cp7`). Run /prime phase 4 closure: read docs/SPEC.md and docs/HANDOFF.md. The Vercel project is deployed at <PASTE PRODUCTION URL>. Run `cd web && npm ci && npm test && node scripts/demo-check.js --url <PRODUCTION URL>`, fix anything that fails (push and open a PR, do not merge), and give me the text to update the Command Center stage to testing with the link. Rules: keep the Python backend working; synthetic data only, no secrets; public demo works with no AI key and no ElevenLabs key; every visible text in EN and ES. End with /hand-off.

---

## c) Friction points

1. **No way to deploy from the session.**
   - What happened: the Vercel MCP tools in this session cover AI Gateway, flags, drives and similar, but have no create-project or deploy tool. There is no `vercel` CLI and no token, which is correct: no secrets in the session.
   - Handled: `web/vercel.json` plus step-by-step instructions in the README and the PR.
   - Unresolved: the deploy and the production run of `demo-check.js`.
2. **Strikes on production are shared.**
   - What happened: on Vercel the client IP can't be spoofed, so every part of `demo-check.js` is one client. Strikes last 1 h, and the limit is 20 questions per minute.
   - Handled: remote mode waits 3.5 s between questions (about 25 questions in total). The guardrail check accepts "reported" early if a run less than 1 h ago left strikes (tested: reported → reported → reported passed).
   - Note: a production run takes about 1.5–2 min.
3. **COOP warning on plain HTTP.**
   - What happened: Chrome logs "Cross-Origin-Opener-Policy header has been ignored" for `http://` origins other than localhost. The remote-mode run against `http://0.0.0.0` failed the "no console errors" checks.
   - Handled: `demo-check.js` ignores that one message, and only for `http:` URLs. Production is HTTPS.
4. **CSP needs `'unsafe-inline'` for scripts.**
   - What happened: the page is prerendered (static), so a per-request nonce is not possible, and Next.js inlines its boot scripts.
   - Accepted risk: there is no third-party script, no user HTML is ever rendered, and `connect-src 'self'` applies.
   - Unresolved, for the pilot: nonces need dynamic rendering, a trade-off to revisit then.
5. **`next dev` writes `web/AGENTS.md`** (the Next.js agent notes) and re-creates it if deleted. It is committed, so the tree stays clean.
6. **Still open from phase 3:**
   - dictation with a real microphone is untested (headless only);
   - "current incident" = earliest incident (after an import, the questions answer about the imported incident). This is unchanged, for parity with Python.

---

## d) Changes in the plan

- No change to SPEC scope; `docs/SPEC.md` not modified.
- Decisions within phase 4:
  - **`DEMO.md` lives in `web/DEMO.md`**, next to the app and `demo-check.js`. It is linked from both READMEs.
  - **Limits across instances:** no shared store (no new dependency, no new secret). A Vercel Firewall rule is the documented option, and Upstash/KV only if the pilot calls a paid AI or voice API.
  - **Trusted IP headers only on Vercel** (`VERCEL=1`). Locally `x-forwarded-for` is still read, so tests can act as several clients.
  - **`Sec-Fetch-Site: same-site` is refused too.** `vercel.app` is a public suffix, so other projects there count as other sites anyway.
  - **The tour asks question 2** (probable cause). That is the strongest answer: cause, runbook RB-01, and MTTR 45 → 8 min.
  - **`DEMO.md` makes no claim of time saved.** A "10–15 min per incident" line was removed because it has no source in the data (veracity rule).
- Open questions (pending Dante):
  - SPEC §6, items 1–5 (public link vs password; voice; AI provider for the pilot; commercial offer; first NMS).
  - Should a `guardrail_report` also send an email (e.g. Resend), or are server logs enough?
  - Delete the old `noc-web-demo` branch?
  - A custom domain (e.g. `noc.monkyfi.com`) instead of `*.vercel.app`?

---

## e) File paths

### Entry points (API routes)
- `web/app/api/ask/route.ts`: modified. Adds `maxDuration = 30`.
- `web/app/api/tts/route.ts`: modified. Adds `maxDuration = 30`.

### Components
- `web/components/GuidedTour.tsx`: created. The tour panel: step label, title, body, progress dots, Back / Next / Finish / Exit, Escape, focus on the title.
- `web/components/NocApp.tsx`: modified.
  - "Start demo" button in the header, tour state, `startTour()` (replay at 120×) and `showTourStep()` (finishes the replay, picks the main incident);
  - the `/#tour` link;
  - `autoAsk` for step 5.
- `web/components/screens/AskQuestions.tsx`: modified. New props `autoQuestion` / `onAutoAsked` (asks one demo question once); scrolls each new answer into view.
- `web/app/globals.css`: modified. Styles for `.top-actions`, `.tour*` and `.shell.touring` (bottom padding, scroll margin), and the mobile layout of the tour panel.

### Modules (`web/lib/`)
- `web/lib/tour.ts`: created. `TOUR_STEPS` (5 screens plus text keys), `TOUR_REPLAY_SPEED = 120`, `TOUR_QUESTION = "askQ2"`, `tourStep()`.
- `web/lib/security-headers.ts`: created. `contentSecurityPolicy(dev)` and `securityHeaders(dev)`.
- `web/lib/server/http.ts`: modified. `onVercel()`; `clientAddress()` reads the Vercel headers first on Vercel and caps the length at 64; `sameOrigin()` checks `Sec-Fetch-Site`.
- `web/lib/i18n.ts`: modified. `tourStart`, `tourLabel`, `tourStepOf`, `tourNext`, `tourBack`, `tourExit`, `tourFinish`, `tour1Title` … `tour5Body`, in EN and ES.

### Configuration and environment
- `web/next.config.ts`: modified. `headers()` applies `securityHeaders()` to `/:path*`.
- `web/vercel.json`: created. Framework `nextjs`, `installCommand: npm ci`, `buildCommand: npm run build`, no `env`.
- `web/package.json`: modified. New script `demo:check`. No new dependency.
- Environment variables: **none needed for the public demo**. Optional, private only: `VOICE_PROVIDER`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (see `web/.env.example`). `VERCEL` is set by the platform.

### Scripts and tests
- `web/scripts/demo-check.js`: created. End-to-end check (HTTP, 7 screens × EN/ES × 1280/375 px, tour, 6 questions, import, strikes, console errors). It reads the texts from `web/lib/i18n.ts`.
- `web/test/security.test.ts`: created. Headers, CSP, client IP on and off Vercel, origin checks, 403 from `/api/ask`, tour data, `vercel.json` without secrets.

### Docs
- `web/DEMO.md`: created. 5-minute demo script in EN and ES.
- `web/README.md`: modified. Status, guided demo, Vercel deploy, security review table, Firewall rule, `demo-check.js`, layout.
- `README.md`: modified. "Web demo" section: tour, Vercel root `web`, link to `web/DEMO.md`.
- `web/AGENTS.md`: created by `next dev` (Next.js agent notes), committed as generated.
- `docs/HANDOFF.md`: modified. This handoff.

### Not changed
- `backend/`, `data/`, `frontend/`, `simulator/`, `web/data/`, `web/test/fixtures/`, `docs/SPEC.md`, `web/package-lock.json`.

### Commands
```bash
# Web app (from web/)
cd web
npm ci
npm run dev                  # http://localhost:3000   (guided demo: /#tour)
npm test                     # 588 tests
npm run typecheck
npm run build
npm start                    # production build; stop with: pkill -f next-server
npm run demo:check           # end-to-end check against http://localhost:3000 (Playwright)
node scripts/demo-check.js --url https://<project>.vercel.app   # against production
node scripts/demo-check.js --url http://localhost:3000 --shots ./shots   # with screenshots
npm run fixtures:check

# Python backend (from repo root)
python3 backend/app.py --load data/alerts.json   # http://localhost:8000
```

---

## History
- 23-nov-2026 · Phase 1 (Scaffold and ported logic) · Done · PR #1 on `noc-web-demo` (merged into `main`).
- 23-nov-2026 · Phase 2 (Screens 1–6, EN/ES, live replay) · Done · PR #2 from `claude/loving-ritchie-cwuqj6` (merged into `main`).
- 23-nov-2026 · Phase 3 (Questions, voice, guardrails, import timestamps) · Done · PR #3 from `claude/affectionate-gauss-a38rr4` (merged into `main`).
- 23-nov-2026 · Phase 4 (Guided demo, security hardening, Vercel config, demo-check, DEMO.md) · Done · PR #4 from `claude/zealous-bell-gd6cp7` (merged into `main`) · Production https://monkyfi-noc-assistant.vercel.app, demo-check 29/29.
