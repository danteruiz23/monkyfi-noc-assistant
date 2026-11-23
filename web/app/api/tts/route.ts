import { handleTts, handleTtsInfo } from "@/lib/server/tts";

// Optional ElevenLabs read-aloud; off unless VOICE_PROVIDER=elevenlabs and ELEVENLABS_API_KEY are set.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return handleTtsInfo();
}

export function POST(req: Request): Promise<Response> {
  return handleTts(req);
}
