#!/usr/bin/env node
/**
 * demo-check.js: end-to-end check of the NOC Assistant demo link.
 *
 *   node scripts/demo-check.js                                # http://localhost:3000 (npm run build && npm start first)
 *   node scripts/demo-check.js --url https://<project>.vercel.app
 *   node scripts/demo-check.js --url ... --shots ./shots      # also save screenshots
 *
 * What it checks (each line prints PASS or FAIL; exit code 1 on any failure):
 *   1. HTTP: security headers, same-origin and content-type checks, body limit,
 *      voice off on the public link (/api/tts says "browser", POST is 404).
 *   2. For EN and ES, at 1280 px and 375 px:
 *      - all 7 screens load, with no horizontal scroll and no text of the other language;
 *      - the main incident: 44 alarms, 19.5 min, INC-1042 to INC-1044;
 *      - the guided tour: 5 steps, replay -> incident -> remediation -> closure -> question;
 *      - no console errors (a CSP violation would show up here).
 *   3. At 1280 px, EN and ES: the 6 demo questions give the right facts; an import with
 *      a month-13 line imports 1 and ignores 1, and the next answer uses 51 alarms.
 *   4. Guardrails: 3 off-topic questions give blocked -> blocked -> reported.
 *
 * Needs Playwright (preinstalled in Claude Code cloud sessions; elsewhere:
 * `npx playwright install chromium` and `npm i -D playwright` once).
 *
 * Local runs send a different x-forwarded-for per browser context, so limits and
 * strikes start fresh for each part. On Vercel the platform sets the client IP,
 * so every part shares one client: the script waits between questions to stay
 * under 20 per minute, and accepts "reported" early if strikes remain from a
 * run less than an hour ago.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

// ---------------------------------------------------------------- arguments
function parseArgs(argv) {
  const out = { url: "http://localhost:3000", shots: null, pace: null, headed: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") out.url = argv[++i];
    else if (a === "--shots") out.shots = argv[++i];
    else if (a === "--pace") out.pace = Number(argv[++i]);
    else if (a === "--headed") out.headed = true;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/demo-check.js [--url URL] [--shots DIR] [--pace MS] [--headed]");
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  out.url = out.url.replace(/\/+$/, "");
  const host = new URL(out.url).hostname;
  out.local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  // Remote: one client for everything, so keep under 20 questions per minute.
  if (out.pace === null || Number.isNaN(out.pace)) out.pace = out.local ? 0 : 3500;
  return out;
}

const opts = parseArgs(process.argv);

// ---------------------------------------------------------------- UI strings
/** Load lib/i18n.ts (TypeScript) so the checks use the app's own texts. */
function loadStrings() {
  const ts = require("typescript");
  const file = path.join(__dirname, "..", "lib", "i18n.ts");
  const source = fs.readFileSync(file, "utf-8") + "\nexport const __LOGIC_ES = LOGIC_ES;\n";
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", js)(mod, mod.exports, require);
  return mod.exports;
}
const { STRINGS, __LOGIC_ES: LOGIC_ES, fmt } = loadStrings();

/**
 * Texts that must NOT appear on screen in `lang`: the other language's UI texts
 * (when they differ) and, in Spanish, the English logic texts that have a Spanish wording.
 */
function foreignTexts(lang) {
  const other = lang === "en" ? "es" : "en";
  const own = new Set(Object.values(STRINGS[lang]));
  const list = [];
  for (const [key, value] of Object.entries(STRINGS[other])) {
    if (value === STRINGS[lang][key] || own.has(value)) continue;
    for (const piece of value.split(/\{\w+\}/)) {
      const p = piece.trim();
      if (p.length >= 14) list.push(p);
    }
  }
  if (lang === "es") for (const en of Object.keys(LOGIC_ES)) if (en.length >= 14) list.push(en);
  return [...new Set(list)];
}

// ---------------------------------------------------------------- results
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, true, typeof detail === "string" ? detail : "");
  } catch (err) {
    record(name, false, String(err && err.message ? err.message : err).split("\n")[0].slice(0, 300));
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastQuestion = 0;
async function pace() {
  const wait = lastQuestion + opts.pace - Date.now();
  if (wait > 0) await sleep(wait);
  lastQuestion = Date.now();
}

let clientCounter = 0;
/** A fresh client id for local runs (ignored by Vercel, which sets the real IP). */
function clientHeaders() {
  clientCounter += 1;
  return opts.local ? { "x-forwarded-for": `10.77.${Math.floor(Date.now() / 1000) % 250}.${clientCounter}` } : {};
}

// ---------------------------------------------------------------- 1. HTTP
const EXPECTED_HEADERS = {
  "content-security-policy": /frame-ancestors 'none'/,
  "x-frame-options": /^DENY$/i,
  "x-content-type-options": /^nosniff$/i,
  "referrer-policy": /^strict-origin-when-cross-origin$/,
  "permissions-policy": /microphone=\(self\)/,
  "strict-transport-security": /max-age=\d+/,
};

async function httpChecks() {
  const ask = `${opts.url}/api/ask`;
  const jsonHeaders = { "content-type": "application/json", ...clientHeaders() };

  await check("http: page loads with security headers", async () => {
    const res = await fetch(`${opts.url}/`);
    assert(res.status === 200, `status ${res.status}`);
    for (const [name, re] of Object.entries(EXPECTED_HEADERS)) {
      const v = res.headers.get(name);
      assert(v && re.test(v), `${name}: ${v}`);
    }
    assert(!res.headers.get("x-powered-by"), "x-powered-by is set");
    const csp = res.headers.get("content-security-policy");
    assert(/connect-src 'self'(;|$)/.test(csp), "connect-src is not 'self' only");
    const html = await res.text();
    assert(html.includes(STRINGS.en.footer), "synthetic-data footer missing");
  });

  await check("http: /api/ask answers JSON, no-store, with security headers", async () => {
    await pace();
    const res = await fetch(ask, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ question: STRINGS.en.askQ5 }) });
    assert(res.status === 200, `status ${res.status}`);
    assert(res.headers.get("cache-control") === "no-store", "cache-control");
    assert(res.headers.get("x-content-type-options") === "nosniff", "nosniff");
    const body = await res.json();
    assert(body.mode === "answer" && body.answer.includes("19.5"), body.answer);
  });

  await check("http: call from another site -> 403", async () => {
    const a = await fetch(ask, { method: "POST", headers: { ...jsonHeaders, origin: "https://evil.example" }, body: "{}" });
    const b = await fetch(ask, { method: "POST", headers: { ...jsonHeaders, "sec-fetch-site": "cross-site" }, body: "{}" });
    assert(a.status === 403 && b.status === 403, `origin ${a.status}, sec-fetch-site ${b.status}`);
    assert(!a.headers.get("access-control-allow-origin"), "CORS header present");
  });

  await check("http: non-JSON body -> 415", async () => {
    const res = await fetch(ask, { method: "POST", headers: { ...clientHeaders(), "content-type": "text/plain" }, body: "hi" });
    assert(res.status === 415, `status ${res.status}`);
  });

  await check("http: oversized body -> 413", async () => {
    await pace();
    const big = JSON.stringify({ question: "x", data: { imported: "a".repeat(1_200_000) } });
    const res = await fetch(ask, { method: "POST", headers: jsonHeaders, body: big });
    assert(res.status === 413, `status ${res.status}`);
  });

  await check("http: voice is the browser's on the public link (no ElevenLabs)", async () => {
    const info = await (await fetch(`${opts.url}/api/tts`)).json();
    assert(info.provider === "browser", `provider ${info.provider}`);
    const res = await fetch(`${opts.url}/api/tts`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ question: "x" }) });
    assert(res.status === 404, `POST /api/tts status ${res.status}`);
  });
}

// ---------------------------------------------------------------- 2-4. browser
const SCREENS = ["incidents", "replay", "detail", "remediation", "summary", "import", "ask"];
const VIEWPORTS = [
  { name: "1280", width: 1280, height: 800 },
  { name: "375", width: 375, height: 812, isMobile: true, hasTouch: true },
];
const TOUR_SCREENS = ["replay", "detail", "remediation", "summary", "ask"];
const TICKETS = ["INC-1042", "INC-1043", "INC-1044"];
/** Facts each demo question's answer must contain (same in EN and ES). */
const FACTS = [["MIA-EDGE-02", "97%"], ["MIA-EDGE-02", "RB-01"], ["44", "12.0%"], TICKETS, ["19.5"], ["ACME Corp", "Globex"]];

async function newPage(browser, viewport, lang) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: Boolean(viewport.isMobile),
    hasTouch: Boolean(viewport.hasTouch),
    deviceScaleFactor: 1,
    extraHTTPHeaders: clientHeaders(),
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Chrome ignores COOP on plain-HTTP origins other than localhost (a transport
    // notice, not an app error); production is HTTPS, where it never appears.
    if (opts.url.startsWith("http:") && /Cross-Origin-Opener-Policy header has been ignored/.test(m.text())) return;
    errors.push(`console: ${m.text()}`);
  });
  await page.goto(`${opts.url}/#incidents`, { waitUntil: "networkidle" });
  await page.locator(".lang button", { hasText: lang.toUpperCase() }).click();
  await page.waitForFunction((l) => document.documentElement.lang === l, lang);
  return { context, page, errors };
}

async function noHorizontalScroll(page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert(sw <= cw + 1, `horizontal scroll: ${sw} > ${cw}`);
}

async function noForeignText(page, lang, foreign) {
  const text = await page.evaluate(() => document.body.innerText);
  const found = foreign.filter((f) => text.includes(f));
  assert(found.length === 0, `untranslated: "${found.slice(0, 3).join('", "')}"`);
}

async function shot(page, name) {
  if (!opts.shots) return;
  fs.mkdirSync(opts.shots, { recursive: true });
  await page.screenshot({ path: path.join(opts.shots, `${name}.png`), fullPage: false });
}

async function lastTurn(page, before, timeout = 15000) {
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid="ask-turn"]').length > n, before, { timeout });
  const turn = page.locator('[data-testid="ask-turn"]').last();
  return { mode: await turn.getAttribute("data-mode"), text: await turn.locator('[data-testid="ask-answer"]').innerText(), all: await turn.innerText() };
}

async function screensAndTour(browser, lang, vp) {
  const tag = `${lang} ${vp.name}px`;
  const foreign = foreignTexts(lang);
  const { context, page, errors } = await newPage(browser, vp, lang);
  try {
    await check(`${tag}: 7 screens load, translated, no horizontal scroll`, async () => {
      for (const s of SCREENS) {
        await page.locator(`nav .tab[data-screen="${s}"]`).click();
        await page.locator(`main[data-screen="${s}"]`).waitFor();
        await noHorizontalScroll(page);
        await noForeignText(page, lang, foreign);
        await shot(page, `${lang}-${vp.name}-${s}`);
      }
    });

    await check(`${tag}: main incident is 44 alarms, 19.5 min, INC-1042 to INC-1044`, async () => {
      await page.locator('nav .tab[data-screen="incidents"]').click();
      const card = page.locator('[data-testid="incident-card"]').first();
      assert((await card.locator('[data-testid="incident-alarms"]').innerText()).trim() === "44", "alarm count");
      assert((await card.locator('[data-testid="incident-duration"]').innerText()).includes("19.5"), "duration");
      const tickets = await card.locator('[data-testid="incident-tickets"]').innerText();
      for (const id of TICKETS) assert(tickets.includes(id), `missing ${id}`);
    });

    await check(`${tag}: guided tour, 5 steps`, async () => {
      await page.locator('[data-testid="tour-start"]').click();
      const tour = page.locator('[data-testid="tour"]');
      for (let i = 0; i < 5; i++) {
        await page.waitForFunction((n) => document.querySelector('[data-testid="tour"]')?.getAttribute("data-step") === String(n), i + 1);
        await page.locator(`main[data-screen="${TOUR_SCREENS[i]}"]`).waitFor();
        const label = await tour.innerText();
        assert(label.includes(fmt(STRINGS[lang].tourStepOf, { n: i + 1, total: 5 })), `step label ${i + 1}`);
        const box = await tour.boundingBox();
        assert(box && box.x >= 0 && box.x + box.width <= vp.width + 1, `tour panel outside the window at step ${i + 1}`);
        await noHorizontalScroll(page);
        await noForeignText(page, lang, foreign);
        if (i === 0) {
          // The replay is running: some alarms are already on screen.
          await page.waitForFunction(() => document.querySelectorAll('[data-testid="replay-feed"] li').length > 0, null, { timeout: 5000 });
        }
        if (i === 1) {
          const merged = await page.locator('[data-testid="merged-tickets"]').innerText();
          for (const id of TICKETS) assert(merged.includes(id), `detail missing ${id}`);
        }
        if (i === 2) assert((await page.locator('[data-testid="runbook-main"]').innerText()).includes("RB-01"), "runbook RB-01");
        if (i === 3) assert((await page.locator('[data-testid="summary-text"]').inputValue()).includes("INC-1042"), "summary");
        if (i === 4) {
          const turn = await lastTurn(page, 0);
          assert(turn.mode === "answer", `tour question mode ${turn.mode}`);
          assert(turn.text.includes("RB-01") && turn.text.includes(lang === "es" ? "Causa probable" : "Probable cause"), turn.text.slice(0, 80));
        }
        await shot(page, `${lang}-${vp.name}-tour-${i + 1}`);
        if (i === 3) await pace(); // the next step asks a question
        await page.locator('[data-testid="tour-next"]').click();
      }
      await tour.waitFor({ state: "detached" });
    });

    await check(`${tag}: no console errors`, async () => {
      assert(errors.length === 0, errors.slice(0, 2).join(" | "));
    });
  } finally {
    await context.close();
  }
}

async function questionsAndImport(browser, lang) {
  const tag = `${lang} 1280px`;
  const { context, page, errors } = await newPage(browser, VIEWPORTS[0], lang);
  try {
    await page.locator('nav .tab[data-screen="ask"]').click();
    await check(`${tag}: the 6 demo questions give the right facts`, async () => {
      for (let i = 0; i < 6; i++) {
        const before = await page.locator('[data-testid="ask-turn"]').count();
        await pace();
        await page.locator(`[data-testid="ask-demo-${i + 1}"]`).click();
        const turn = await lastTurn(page, before);
        assert(turn.mode === "answer", `Q${i + 1} mode ${turn.mode}: ${turn.text.slice(0, 80)}`);
        for (const fact of FACTS[i]) assert(turn.text.includes(fact), `Q${i + 1} missing "${fact}"`);
        assert(turn.all.includes(fmt(STRINGS[lang].askDataNote, { alarms: 50, incidents: 2 })), `Q${i + 1} data note`);
      }
    });

    await check(`${tag}: import with a month-13 line imports 1, ignores 1; next answer uses 51 alarms`, async () => {
      await page.locator('nav .tab[data-screen="import"]').click();
      const good = "<134>1 2026-11-02T09:00:00Z MIA-EDGE-02 BGP-5-ADJCHANGE: Te0/0/0/1 bgp_neighbor_state=down BGP neighbor 198.51.100.8 state changed to down";
      const bad = good.replace("2026-11-02", "2026-13-02");
      await page.locator('[data-testid="import-text"]').fill(`${good}\n${bad}`);
      await page.locator('[data-testid="import-analyze"]').click();
      const status = await page.locator('[data-testid="import-status"]').innerText();
      assert(status.includes(fmt(STRINGS[lang].impDone, { n: 1, m: 1 })), status);
      await page.locator('nav .tab[data-screen="ask"]').click();
      const before = await page.locator('[data-testid="ask-turn"]').count();
      await pace();
      await page.locator('[data-testid="ask-demo-5"]').click();
      const turn = await lastTurn(page, before);
      assert(turn.mode === "answer", `mode ${turn.mode}`);
      assert(turn.all.includes(fmt(STRINGS[lang].askDataNote, { alarms: 51, incidents: 3 })), turn.all.slice(-120));
    });

    await check(`${tag}: no console errors`, async () => {
      assert(errors.length === 0, errors.slice(0, 2).join(" | "));
    });
  } finally {
    await context.close();
  }
}

async function guardrails(browser) {
  const tag = "en 1280px";
  const { context, page } = await newPage(browser, VIEWPORTS[0], "en");
  try {
    await page.locator('nav .tab[data-screen="ask"]').click();
    await check(`${tag}: 3 off-topic questions -> blocked, blocked, reported`, async () => {
      const questions = ["What's the weather in Miami today?", "Write me a poem about cats", "Who will win the World Cup?"];
      const modes = [];
      for (const q of questions) {
        const before = await page.locator('[data-testid="ask-turn"]').count();
        await page.locator('[data-testid="ask-input"]').fill(q);
        await pace();
        await page.locator('[data-testid="ask-send"]').click();
        const turn = await lastTurn(page, before);
        modes.push(turn.mode);
        assert(!turn.text.toLowerCase().includes("rule"), "a fixed reply mentions rules");
      }
      const detail = modes.join(" -> ");
      if (opts.local) {
        assert(detail === "blocked -> blocked -> reported", detail);
      } else {
        // Shared client on Vercel: strikes from a recent run may still count.
        assert(modes.every((m) => m === "blocked" || m === "reported") && modes[2] === "reported", detail);
      }
      return detail;
    });
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------- main
async function main() {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.error("Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium");
    process.exit(2);
  }
  console.log(`demo-check: ${opts.url} (${opts.local ? "local" : "remote"}, ${opts.pace} ms between questions)\n`);
  const started = Date.now();
  await httpChecks();
  const browser = await chromium.launch({ headless: !opts.headed });
  try {
    for (const lang of ["en", "es"]) {
      for (const vp of VIEWPORTS) await screensAndTour(browser, lang, vp);
      await questionsAndImport(browser, lang);
    }
    await guardrails(browser);
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed in ${Math.round((Date.now() - started) / 1000)} s.`);
  if (failed.length) {
    console.log("Failed:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
