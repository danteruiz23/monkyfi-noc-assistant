/**
 * Phase 4: security headers, client address on Vercel, same-origin checks,
 * the guided tour data, and the deploy config.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STRINGS } from "@/lib/i18n";
import { REPLAY_SPEEDS } from "@/lib/replay";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";
import { clientAddress, clientKey, onVercel, sameOrigin } from "@/lib/server/http";
import { createAskDeps, handleAsk } from "@/lib/server/ask";
import { TOUR_QUESTION, TOUR_REPLAY_SPEED, TOUR_STEPS, tourStep } from "@/lib/tour";
import { WEB } from "./helpers";

const VERCEL = { VERCEL: "1" };
const LOCAL = {};

function req(headers: Record<string, string>, url = "https://noc.example.test/api/ask"): Request {
  return new Request(url, { method: "POST", headers });
}

describe("security headers", () => {
  const byKey = (dev = false) => Object.fromEntries(securityHeaders(dev).map((h) => [h.key, h.value]));

  it("sets the expected headers", () => {
    const h = byKey();
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=\d{8}/);
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Permissions-Policy"]).toContain("microphone=(self)");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("CSP keeps everything on this site and forbids framing", () => {
    const csp = contentSecurityPolicy();
    for (const d of [
      "default-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "media-src 'self' blob:",
    ]) {
      expect(csp).toContain(d);
    }
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/https?:/);
    expect(csp).not.toContain("*");
  });

  it("dev mode adds only what hot reload needs", () => {
    const dev = contentSecurityPolicy(true);
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("connect-src 'self' ws: wss:");
  });

  it("next.config.ts applies them to every path", () => {
    const config = readFileSync(path.join(WEB, "next.config.ts"), "utf-8");
    expect(config).toContain('source: "/:path*"');
    expect(config).toContain("securityHeaders(");
    expect(config).toContain("poweredByHeader: false");
  });
});

describe("client address", () => {
  it("on Vercel prefers x-vercel-forwarded-for, then x-real-ip, then x-forwarded-for", () => {
    expect(onVercel(VERCEL)).toBe(true);
    expect(onVercel(LOCAL)).toBe(false);
    const all = { "x-vercel-forwarded-for": "203.0.113.7", "x-real-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.1" };
    expect(clientAddress(req(all), VERCEL)).toBe("203.0.113.7");
    expect(clientAddress(req({ "x-real-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.1" }), VERCEL)).toBe("203.0.113.8");
    expect(clientAddress(req({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }), VERCEL)).toBe("198.51.100.1");
  });

  it("off Vercel ignores x-vercel-forwarded-for (a client could send it)", () => {
    const h = { "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "198.51.100.1" };
    expect(clientAddress(req(h), LOCAL)).toBe("198.51.100.1");
    expect(clientAddress(req({ "x-vercel-forwarded-for": "203.0.113.7" }), LOCAL)).toBe("local");
    expect(clientAddress(req({}), LOCAL)).toBe("local");
  });

  it("caps the length and the key is a short hash, never the raw address", () => {
    expect(clientAddress(req({ "x-forwarded-for": "x".repeat(500) }), LOCAL)).toHaveLength(64);
    const key = clientKey(req({ "x-forwarded-for": "198.51.100.1" }));
    expect(key).toMatch(/^[0-9a-f]{16}$/);
    expect(key).not.toContain("198");
  });
});

describe("same origin", () => {
  const host = { host: "noc.example.test" };

  it("accepts same-origin browser calls and calls without browser headers", () => {
    expect(sameOrigin(req({ ...host, origin: "https://noc.example.test", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(sameOrigin(req({ ...host }))).toBe(true);
    expect(sameOrigin(req({ ...host, "sec-fetch-site": "none" }))).toBe(true);
  });

  it("refuses other sites, sibling subdomains and null origins", () => {
    expect(sameOrigin(req({ ...host, origin: "https://evil.example" }))).toBe(false);
    expect(sameOrigin(req({ ...host, "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(sameOrigin(req({ ...host, "sec-fetch-site": "same-site" }))).toBe(false);
    expect(sameOrigin(req({ ...host, origin: "null" }))).toBe(false);
    expect(sameOrigin(req({ ...host, origin: "https://noc.example.test.evil.example" }))).toBe(false);
  });

  it("the questions route answers a cross-site call with 403 and no CORS header", async () => {
    const res = await handleAsk(
      new Request("https://noc.example.test/api/ask", {
        method: "POST",
        headers: { ...host, "content-type": "application/json", "sec-fetch-site": "cross-site" },
        body: JSON.stringify({ question: "What is the probable cause?" }),
      }),
      createAskDeps(),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("guided tour", () => {
  it("has 5 steps: replay -> incident -> remediation -> closure -> question", () => {
    expect(TOUR_STEPS.map((s) => s.screen)).toEqual(["replay", "detail", "remediation", "summary", "ask"]);
  });

  it("every step text exists in EN and ES", () => {
    for (const step of TOUR_STEPS) {
      for (const lang of ["en", "es"] as const) {
        expect(STRINGS[lang][step.title].trim()).not.toBe("");
        expect(STRINGS[lang][step.body].trim()).not.toBe("");
      }
      expect(STRINGS.es[step.body]).not.toBe(STRINGS.en[step.body]);
    }
    for (const key of ["tourStart", "tourNext", "tourBack", "tourExit", "tourFinish", "tourStepOf"] as const) {
      expect(STRINGS.es[key]).not.toBe(STRINGS.en[key]);
    }
  });

  it("states the SPEC facts and asks a demo question", () => {
    expect(STRINGS.en.tour2Body).toContain("44 alarms");
    expect(STRINGS.en.tour2Body).toContain("19.5 minutes");
    expect(STRINGS.es.tour2Body).toContain("19.5 minutos");
    expect(STRINGS.en.tour5Body).toContain(STRINGS.en[TOUR_QUESTION]);
    expect(STRINGS.es.tour5Body).toContain(STRINGS.es[TOUR_QUESTION]);
    expect(REPLAY_SPEEDS).toContain(TOUR_REPLAY_SPEED);
  });

  it("step index is clamped", () => {
    expect(tourStep(-1)).toBe(0);
    expect(tourStep(99)).toBe(4);
    expect(tourStep(Number.NaN)).toBe(0);
    expect(tourStep(2)).toBe(2);
  });
});

describe("deploy config", () => {
  it("vercel.json uses npm ci and sets no secrets or voice variables", () => {
    const raw = readFileSync(path.join(WEB, "vercel.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.installCommand).toBe("npm ci");
    expect(config.framework).toBe("nextjs");
    expect(config.env).toBeUndefined();
    expect(raw).not.toMatch(/ELEVENLABS|VOICE_PROVIDER|API_KEY/i);
  });
});
