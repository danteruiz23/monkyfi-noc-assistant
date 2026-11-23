/**
 * Optional ElevenLabs read-aloud (server only).
 *
 * OFF by default. It is on only when BOTH variables are set on the server:
 *   VOICE_PROVIDER=elevenlabs
 *   ELEVENLABS_API_KEY=<key>          (never in the repo; Vercel env or .env.local)
 *   ELEVENLABS_VOICE_ID=<voice id>    (optional; a premade voice by default)
 * Otherwise the browser's own speech synthesis is used, with no cost and no key.
 *
 * GET  /api/tts  -> { provider: "browser" | "elevenlabs" }
 * POST /api/tts  -> audio/mpeg for the assistant's answer to { question, lang, data }.
 *   The text to speak is rebuilt here from the question, so this route can
 *   only ever speak the assistant's own answers, never arbitrary text.
 *   Off-topic and manipulation questions are not spoken (409) and do not add strikes.
 */
import "server-only";
import { createHash } from "node:crypto";
import { assessQuestion, RateLimiter, replyText } from "../guardrails";
import { type Lang } from "../i18n";
import { currentEvents, demoData, MAX_ASK_BODY_BYTES } from "./ask";
import { clientKey, json, readBody, sameOrigin } from "./http";

/** Premade ElevenLabs voice (the same default as backend/llm_client.py). */
export const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
export const TTS_PER_MINUTE = 10;
const CACHE_LIMIT = 50;
const MAX_TEXT_CHARS = 1000;

type Env = Record<string, string | undefined>;

export type VoiceProvider = "browser" | "elevenlabs";

export function voiceProvider(env: Env = process.env): VoiceProvider {
  const wanted = (env.VOICE_PROVIDER ?? "").trim().toLowerCase();
  const key = (env.ELEVENLABS_API_KEY ?? "").trim();
  return wanted === "elevenlabs" && key ? "elevenlabs" : "browser";
}

export interface TtsDeps {
  env: Env;
  fetch: typeof fetch;
  limiter: RateLimiter;
  cache: Map<string, ArrayBuffer>;
}

export function createTtsDeps(env: Env = process.env): TtsDeps {
  return {
    env,
    fetch: (...args) => fetch(...args),
    limiter: new RateLimiter(TTS_PER_MINUTE, 60 * 1000),
    cache: new Map(),
  };
}

let defaultDeps: TtsDeps | null = null;
function getDefaultDeps(): TtsDeps {
  defaultDeps ??= createTtsDeps();
  return defaultDeps;
}

export function handleTtsInfo(deps: TtsDeps = getDefaultDeps()): Response {
  return json({ provider: voiceProvider(deps.env) });
}

export async function handleTts(req: Request, deps: TtsDeps = getDefaultDeps()): Promise<Response> {
  if (voiceProvider(deps.env) !== "elevenlabs") return json({ error: "voice_provider_off" }, 404);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) {
    return json({ error: "unsupported_media_type" }, 415);
  }
  const { ok, retryAfter } = deps.limiter.hit(clientKey(req));
  if (!ok) return json({ error: "busy" }, 429, { "Retry-After": String(retryAfter) });

  const body = await readBody(req, MAX_ASK_BODY_BYTES);
  if (!body.ok) return json({ error: "bad_request" }, body.status);
  let payload: { question?: unknown; lang?: unknown; data?: unknown };
  try {
    payload = JSON.parse(body.text);
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!payload || typeof payload !== "object" || typeof payload.question !== "string") {
    return json({ error: "bad_request" }, 400);
  }
  const lang: Lang = payload.lang === "es" ? "es" : "en";
  const current = currentEvents(payload.data);
  if (!current.ok) return json({ error: "bad_request" }, 400);
  let text: string;
  try {
    const assessment = assessQuestion(payload.question, current.events, demoData().runbooks);
    if (assessment.mode === "strike") return json({ error: "not_spoken" }, 409);
    text = replyText(assessment, lang, 0).slice(0, MAX_TEXT_CHARS);
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const voiceId = (deps.env.ELEVENLABS_VOICE_ID ?? "").trim() || DEFAULT_VOICE_ID;
  const cacheKey = createHash("sha256").update(`${voiceId}\n${text}`).digest("hex");
  let audio = deps.cache.get(cacheKey);
  if (!audio) {
    try {
      const res = await deps.fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": (deps.env.ELEVENLABS_API_KEY ?? "").trim(),
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!res.ok) return json({ error: "voice_service_failed" }, 502);
      audio = await res.arrayBuffer();
    } catch {
      return json({ error: "voice_service_failed" }, 502);
    }
    deps.cache.set(cacheKey, audio);
    while (deps.cache.size > CACHE_LIMIT) {
      const oldest = deps.cache.keys().next().value;
      if (oldest === undefined) break;
      deps.cache.delete(oldest);
    }
  }
  return new Response(audio, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
