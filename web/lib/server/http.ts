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

/**
 * The client's address, from the proxy headers (Vercel sets x-forwarded-for
 * and x-real-ip). Only used hashed, as a key for limits and strikes.
 */
export function clientAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

/** A short one-way hash of the client address: no raw IP in memory keys or logs. */
export function clientKey(req: Request): string {
  return createHash("sha256").update(`noc-demo:${clientAddress(req)}`).digest("hex").slice(0, 16);
}

/**
 * Same-origin check: a browser call from another site is refused. Requests
 * with no Origin header (curl, server-to-server) pass; the rate limit covers them.
 */
export function sameOrigin(req: Request): boolean {
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
