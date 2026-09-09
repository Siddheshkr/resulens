import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { getMatchRun } from "@/server/matching/service";
import { z } from "zod";

type RouteContext = { params: Promise<{ runId: string }> };

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const { runId } = await context.params;
    if (!z.string().uuid().safeParse(runId).success) {
      return Response.json({ error: "Match run not found" }, { status: 404 });
    }
    const run = await getMatchRun(userId, runId);
    return run
      ? Response.json({ run })
      : Response.json({ error: "Match run not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    return Response.json({ error: "Could not load match results." }, { status: 503 });
  }
}
