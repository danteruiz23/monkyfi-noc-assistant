# Monkyfi NOC Assistant — web demo (`web/`)

Next.js (TypeScript) version of the NOC Assistant for the public demo link.
It uses **synthetic data only** and needs **no AI key and no ElevenLabs key**.
See `../docs/SPEC.md` for the plan (Block A, phases 1–4).

> Status: **phase 1** — the deterministic logic is ported from the Python backend
> and checked against it. The page is a placeholder; the demo screens arrive in phase 2.

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
| `lib/i18n.ts` | Every visible text, EN and ES. |
| `data/` | Copies of `../data/` (a test checks they stay identical). |
| `scripts/generate_fixtures.py` | Runs the real Python backend and writes `test/fixtures/`. |
| `test/` | Parity tests: TypeScript output must equal the Python output. |

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
