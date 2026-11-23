import { handleAsk } from "@/lib/server/ask";

// Answers are built on each request from the synthetic demo data: no AI, no key.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Answers take milliseconds; a short cap limits the cost of a stuck request (ElevenLabs has its own 20 s timeout).
export const maxDuration = 30;

export function POST(req: Request): Promise<Response> {
  return handleAsk(req);
}
