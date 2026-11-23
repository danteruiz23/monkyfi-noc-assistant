/**
 * Small HTTP helpers shared by the API routes (server only).
 */
import "server-only";
import { createHash } from "node:crypto";

/** JSON response that is never cached and never sniffed. */
export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

/** True on Vercel (the platform sets VERCEL=1 in every function). */
export function onVercel(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL === "1";
}

function firstAddress(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first ? first.slice(0, 64) : null;
}

/**
 * The client's address, only used hashed as a key for limits and strikes.
 *
 * On Vercel the platform overwrites `x-forwarded-for` and `x-real-ip` with the
 * real client address and also sets `x-vercel-forwarded-for`, so a client
 * cannot choose its own key there. `x-vercel-forwarded-for` is read first;
 * Vercel docs: https://vercel.com/docs/headers/request-headers
 *
 * Elsewhere (local `next start`) the headers come from the caller and can be
 * spoofed: fine for local tests, which use them to act as different clients.
 */
export function clientAddress(req: Request, env: Record<string, string | undefined> = process.env): string {
  const h = req.headers;
  const order = onVercel(env)
    ? ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]
    : ["x-forwarded-for", "x-real-ip"];
  for (const name of order) {
    const address = firstAddress(h.get(name));
    if (address) return address;
  }
  return "local";
}

/** A short one-way hash of the client address: no raw IP in memory keys or logs. */
export function clientKey(req: Request): string {
  return createHash("sha256").update(`noc-demo:${clientAddress(req)}`).digest("hex").slice(0, 16);
}

/**
 * Same-origin check for the API routes.
 *
 * - `Sec-Fetch-Site` (sent by every current browser) must be `same-origin`
 *   or `none`; `same-site` and `cross-site` are refused.
 * - `Origin`, when present, must match the host the request was sent to.
 *   `Origin: null` (sandboxed frames, some redirects) is refused.
 *
 * Requests with neither header (curl, scripts) pass: they are not a browser
 * acting for a visitor, and the rate limit covers them. The routes also only
 * accept `Content-Type: application/json`, which a cross-site page cannot send
 * without a CORS preflight, and no route answers a preflight with CORS headers.
 */
export function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type BodyResult = { ok: true; text: string } | { ok: false; status: 413 | 400 };

/** Read the request body as text, stopping as soon as it passes `maxBytes`. */
export async function readBody(req: Request, maxBytes: number): Promise<BodyResult> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };
  if (!req.body) return { ok: true, text: "" };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(all) };
  } catch {
    return { ok: false, status: 400 };
  }
}
