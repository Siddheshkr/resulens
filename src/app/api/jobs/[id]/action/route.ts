import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { jobActionSchema } from "@/server/matching/requests";
import { deleteJobAction, saveJobAction } from "@/server/matching/service";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const rate = checkRateLimit(`job-action:${userId}`, 60, 60_000);
    if (!rate.allowed) {
      return Response.json(
        { error: "Too many job actions. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success)
      return Response.json({ error: "Job not found" }, { status: 404 });
    const body = jobActionSchema.safeParse(await request.json().catch(() => null));
    if (!body.success)
      return Response.json({ error: "Choose saved, dismissed, or applied." }, { status: 400 });
    const action = await saveJobAction(userId, id, body.data.state, body.data.matchRunId);
    return Response.json({ action });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    return Response.json({ error: "Could not save the job action." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success)
      return Response.json({ error: "Job not found" }, { status: 404 });
    await deleteJobAction(userId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    return Response.json({ error: "Could not clear the job action." }, { status: 503 });
  }
}
