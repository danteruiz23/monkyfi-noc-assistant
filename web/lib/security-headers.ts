/**
 * Security headers for every response (used by next.config.ts, checked by
 * test/security.test.ts and scripts/demo-check.js).
 *
 * Content-Security-Policy notes:
 * - The page is prerendered (static), so a per-request nonce is not possible.
 *   Next.js inlines its boot scripts, so `script-src` needs 'unsafe-inline'.
 *   There is no third-party script, no user HTML is ever rendered, and
 *   `connect-src 'self'` keeps every call on this site.
 * - `media-src blob:` is for the optional ElevenLabs clip (played from a blob URL).
 * - `frame-ancestors 'none'` (and X-Frame-Options) stops the demo from being framed.
 * - Dev mode (next dev) also needs 'unsafe-eval' and a websocket for hot reload.
 */
export interface Header {
  key: string;
  value: string;
}

export function contentSecurityPolicy(dev = false): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "media-src": ["'self'", "blob:"],
    "connect-src": ["'self'", ...(dev ? ["ws:", "wss:"] : [])],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders(dev = false): Header[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(dev) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Only this site may use the microphone (browser dictation); everything else is off.
    {
      key: "Permissions-Policy",
      value:
        "microphone=(self), camera=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), " +
        "magnetometer=(), gyroscope=(), accelerometer=(), display-capture=(), browsing-topics=()",
    },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];
}
