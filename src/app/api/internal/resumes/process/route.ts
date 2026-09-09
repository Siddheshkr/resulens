import { workerRequestSchema } from "@/lib/resumes/requests";
import { processResume } from "@/server/resumes/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configuredSecret = process.env.RESUME_WORKER_SECRET;
  const providedSecret = request.headers.get("x-resulens-worker-secret");

  if (!configuredSecret || !providedSecret || providedSecret !== configuredSecret) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = workerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid worker request" }, { status: 400 });
  }

  const result = await processResume(
    body.data.resumeId,
    request.headers.get("x-resulens-worker-id") ?? crypto.randomUUID(),
    body.data.jobId,
  );
  return Response.json(result);
}
