import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { jobFeedbackSchema } from "@/server/matching/requests";
import { saveJobFeedback } from "@/server/matching/service";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const rate = checkRateLimit(`job-feedback:${userId}`, 20, 60_000);
    if (!rate.allowed) {
      return Response.json(
        { error: "Too much feedback activity. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success)
      return Response.json({ error: "Job not found" }, { status: 404 });
    const body = jobFeedbackSchema.safeParse(await request.json().catch(() => null));
    if (!body.success)
      return Response.json({ error: "Choose relevant or not relevant." }, { status: 400 });
    const feedback = await saveJobFeedback(
      userId,
      id,
      body.data.label,
      body.data.note,
      body.data.matchRunId,
    );
    return Response.json({ feedback });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    return Response.json({ error: "Could not save feedback." }, { status: 503 });
  }
}
