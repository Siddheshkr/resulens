import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createMatchRunSchema } from "@/server/matching/requests";
import { createMatchRun, getLatestMatchRun } from "@/server/matching/service";
import { z } from "zod";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

function invalidRequest() {
  return Response.json(
    { error: "Choose an approved resume and valid matching preferences." },
    { status: 400 },
  );
}

function serviceError(error: unknown) {
  if (error instanceof Error && /approve|not found|preferences/i.test(error.message)) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return Response.json({ error: "Matching is temporarily unavailable." }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireUser();
    const resumeId = new URL(request.url).searchParams.get("resumeId") ?? undefined;
    if (resumeId && !z.string().uuid().safeParse(resumeId).success) return invalidRequest();
    const run = await getLatestMatchRun(userId, resumeId);
    return Response.json({ run });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireUser();
    const rate = checkRateLimit(`match-run:${userId}`, 10, 60_000);
    if (!rate.allowed) {
      return Response.json(
        { error: "Too many matching requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    const body = createMatchRunSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return invalidRequest();
    const result = await createMatchRun(userId, body.data.resumeId, body.data.preferences, {
      retry: body.data.retry,
    });
    return Response.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    return serviceError(error);
  }
}
