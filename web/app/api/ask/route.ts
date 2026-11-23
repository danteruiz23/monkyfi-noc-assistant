import { handleAsk } from "@/lib/server/ask";

// Answers are built on each request from the synthetic demo data: no AI, no key.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request): Promise<Response> {
  return handleAsk(req);
}
