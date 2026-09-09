import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { explanationRequestSchema } from "@/server/matching/requests";
import {
  generateMatchExplanation,
  generateTopMatchExplanations,
} from "@/server/matching/explanations";
import { z } from "zod";

type RouteContext = { params: Promise<{ runId: string }> };

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const rate = checkRateLimit(`match-explanation:${userId}`, 3, 60_000);
    if (!rate.allowed) {
      return Response.json(
        { error: "Too many explanation requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    const { runId } = await context.params;
    if (!z.string().uuid().safeParse(runId).success) {
      return Response.json({ error: "Match run not found" }, { status: 404 });
    }
    const body = explanationRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success)
      return Response.json({ error: "Invalid explanation request" }, { status: 400 });
    const explanations = body.data.jobMatchId
      ? [await generateMatchExplanation(userId, runId, body.data.jobMatchId)]
      : await generateTopMatchExplanations(userId, runId);
    return Response.json({ explanations });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    return Response.json(
      { error: "Explanation generation is temporarily unavailable." },
      { status: 503 },
    );
  }
}
