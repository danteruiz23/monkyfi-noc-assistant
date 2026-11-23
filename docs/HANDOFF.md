# HANDOFF — Monkyfi NOC Assistant

**Phase:** Block A · Phase 4 closure — production check and Command Center update
**Date:** 23-nov-2026
**Status:** **Done.** Production at **https://monkyfi-noc-assistant.vercel.app** passes `demo-check.js` 29/29. The app needed no fix. One step is left for Dante: confirm the Command Center update (development → testing).
**Branch:** `claude/brave-davinci-v0a6r2` (based on `main` @ `4e6a30e`, after PR #4 merged) · **PR:** https://github.com/danteruiz23/monkyfi-noc-assistant/pull/6 (base `main`, open, not merged)

---

## a) Summary of tasks

- [x] /prime phase 4 closure: read `docs/SPEC.md` and `docs/HANDOFF.md`. PR #4 was already merged into `main`.
- [x] `cd web && npm ci && npm test` → 7 files, **588 passed**.
- [x] Local production build: `npm run build`, then `npx next start -p 3100`, then `node scripts/demo-check.js --url http://localhost:3100` → **29/29** (10 s).
- [x] Network access: this session moved to the existing personal environment `monkyfi-noc-assistant`, which allows only `monkyfi-noc-assistant.vercel.app`. The Default environment was not changed.
- [x] **Production:** `NODE_USE_ENV_PROXY=1 node scripts/demo-check.js --url https://monkyfi-noc-assistant.vercel.app` → **29/29** (78 s), in EN and ES, at 1280 and 375 px. It covered:
  - the security headers (CSP, HSTS, XFO DENY, COOP/CORP);
  - 403 on calls from another site, 415 on non-JSON, 413 on oversized bodies;
  - voice in the browser (no ElevenLabs);
  - the tour, the 6 questions, the import, and blocked → blocked → reported.
- [x] `demo-check.js`: prints a `NODE_USE_ENV_PROXY=1` hint when the HTTP checks fail with "fetch failed" behind a proxy. I confirmed the hint prints on a run without the variable.
- [x] READMEs: production link added; the proxy note is in `web/README.md`.
- [x] Python backend: `python3 backend/app.py --port 8123 --load data/alerts.json` → main incident 44 events, 19.5 min, `ticket_ids` INC-1042, INC-1043, INC-1044.
- [x] `npm run typecheck` → OK; `npm run build` → OK.
- [x] Pushed and opened PR #6 (not merged).
- [x] Command Center text prepared (read-only check of the record; nothing written). The text is in b) step 2.
- [ ] **Command Center write.** Pending Dante's explicit "yes".

---

## b) Next steps for the next session

1. Merge PR #6. It changes docs and tooling only; the production app is unchanged.
2. **Command Center**: confirm the update, or paste it by hand. The record is `NOC Assistant` · project "Monkyfi Agent Portfolio" (Monkyfi LLC) · id `10745616-40df-4e36-a009-a1546a557a4f`.

   | Field | Before | After |
   |---|---|---|
   | stage | development | testing |
   | purpose | "…Corre solo en local (localhost:8000); no está desplegado en Vercel. La correlación, remediación y resúmenes usan reglas fijas; los prompts de Claude existen como plantillas pero aún no están conectados." | see below |

   New `purpose`:
   > Asistente para el NOC: recibe alarmas, las correlaciona en incidentes, propone remediación según runbooks y redacta resúmenes de cierre. Demo en vivo: https://monkyfi-noc-assistant.vercel.app (EN/ES, datos sintéticos, recorrido guiado en /#tour). Sin clave de IA ni de ElevenLabs: reglas fijas y voz del navegador. El backend Python queda como referencia local.

   History note, title:
   > Avance: NOC Assistant – demo en Vercel y paso a testing

   History note, body:
   > Etapa: development → testing. Demo en vivo: https://monkyfi-noc-assistant.vercel.app. demo-check.js 29/29 en producción el 23-nov-2026 (EN/ES, 1280 y 375 px, recorrido de 5 pasos, 6 preguntas, importar alarmas, guardrails, encabezados de seguridad). Sin clave de IA ni de voz. Repo: https://github.com/danteruiz23/monkyfi-noc-assistant (PR #4 y #6).
3. Optional: add the Vercel Firewall rule (`/api/` → 30 requests per 60 s per IP → 429), as described in `web/README.md`.
4. Test dictation with a real microphone in Chrome or Edge (`web/DEMO.md`, steps 2–3).
5. Rehearse `web/DEMO.md` once in EN and once in ES (5 min each).
6. Then Block B (phase 5, real alarm intake), once Dante answers the open questions in SPEC §6.

**Prompt to start the next session (paste as is):**

> Repo danteruiz23/monkyfi-noc-assistant, branch `main` (after PR #6 is merged). Run /prime phase 5: read docs/SPEC.md and docs/HANDOFF.md. Phase 4 is closed (production https://monkyfi-noc-assistant.vercel.app, demo-check 29/29). Before building, list the SPEC §6 open questions that block phase 5 (real alarm intake: webhook and syslog from the client NMS, with authentication) and propose answers. Rules: keep the Python backend working; synthetic data only, no secrets; the public demo keeps working with no AI key and no ElevenLabs key; every visible text in EN and ES. End with /hand-off.

---

## c) Friction points

1. **The production URL was a placeholder.**
   - What happened: the starting prompt still said `<PASTE PRODUCTION URL>`.
   - Handled: I asked Dante; the answer was `monkyfi-noc-assistant.vercel.app`.
2. **The session's network blocked `*.vercel.app`.**
   - What happened: the proxy returned 403 on CONNECT.
   - Handled: the session moved to the existing personal environment `monkyfi-noc-assistant`, which allows only that host. The Default environment was not changed. Start future sessions for this repo on that environment.
3. **"fetch failed" on the six HTTP checks.**
   - What happened: Node's built-in `fetch` ignores `HTTPS_PROXY` (Node 22.23 here). The browser checks passed, because Chromium uses the proxy.
   - Handled: run with `NODE_USE_ENV_PROXY=1` → 29/29. The script now prints that hint, and the README documents it. A harmless `UNDICI-EHPA` "experimental" warning is printed.
4. **Production strikes are shared** (unchanged from phase 4). Three production runs within an hour all passed; the guardrail check accepts "reported" early.
5. **Still open from earlier phases:**
   - real-microphone dictation is untested;
   - the CSP needs `'unsafe-inline'` for scripts (static prerender);
   - "current incident" = the earliest incident.

---

## d) Changes in the plan

- None to SPEC scope; `docs/SPEC.md` not modified. The phase 4 acceptance is met: `demo-check.js` has no failures in production, in EN/ES, at 1280 and 375 px.
- The Command Center write was not done in this session: the request was for the text, and that skill writes only after an explicit "yes".
- Open questions (pending Dante), unchanged:
  - SPEC §6, items 1–5;
  - email on `guardrail_report`?
  - delete the old `noc-web-demo` branch?
  - a custom domain (e.g. `noc.monkyfi.com`)?

---

## e) File paths

### Scripts
- `web/scripts/demo-check.js`: modified.
  - The header comment explains `NODE_USE_ENV_PROXY=1` behind a proxy.
  - `main()` prints a hint when `HTTPS_PROXY` is set, `NODE_USE_ENV_PROXY` is not, and a check failed with "fetch failed".

### Docs
- `web/README.md`: modified. Live link in the status block; proxy note and command under the demo-check paragraph.
- `README.md`: modified. Live link in the "Web demo" section.
- `docs/HANDOFF.md`: modified. This handoff.

### Configuration and environment
- No repo config changed. Environment variables for the public demo: **none**. `VERCEL` is set by the platform. Optional, private only: `VOICE_PROVIDER`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
- Cloud session network (not in the repo): the personal environment `monkyfi-noc-assistant` allows `monkyfi-noc-assistant.vercel.app`.

### Not changed
- `web/app/`, `web/components/`, `web/lib/`, `web/test/`, `web/data/`, `web/next.config.ts`, `web/vercel.json`, `web/package.json`, `web/package-lock.json`, `backend/`, `data/`, `frontend/`, `simulator/`, `docs/SPEC.md`.

### Commands
```bash
# Web app (from web/)
cd web
npm ci
npm test                     # 588 tests
npm run typecheck
npm run build
npm run dev                  # http://localhost:3000   (guided demo: /#tour)
npx next start -p 3100       # production build; stop with: pkill -f next-server
node scripts/demo-check.js --url http://localhost:3100
NODE_USE_ENV_PROXY=1 node scripts/demo-check.js --url https://monkyfi-noc-assistant.vercel.app   # production, behind a proxy
npm run fixtures:check

# Python backend (from repo root)
python3 backend/app.py --load data/alerts.json   # http://localhost:8000
```

---

## History
- 23-nov-2026 · Phase 1 (Scaffold and ported logic) · Done · PR #1 on `noc-web-demo` (merged into `main`).
- 23-nov-2026 · Phase 2 (Screens 1–6, EN/ES, live replay) · Done · PR #2 from `claude/loving-ritchie-cwuqj6` (merged into `main`).
- 23-nov-2026 · Phase 3 (Questions, voice, guardrails, import timestamps) · Done · PR #3 from `claude/affectionate-gauss-a38rr4` (merged into `main`).
- 23-nov-2026 · Phase 4 (Guided demo, security hardening, Vercel config, demo-check, DEMO.md) · Partially done (deploy pending Dante) · PR #4 from `claude/zealous-bell-gd6cp7` (merged into `main`).
- 23-nov-2026 · Phase 4 closure (production verified 29/29, proxy hint in demo-check) · Done · PR #6 from `claude/brave-davinci-v0a6r2` to `main` (open).
