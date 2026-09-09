import { randomUUID, timingSafeEqual } from "node:crypto";

import { embeddingWorkerRequestSchema } from "@/server/matching/requests";
import { processEmbeddingJob } from "@/server/matching/processor";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasWorkerSecret(request: Request) {
  const configured = process.env.MATCHING_WORKER_SECRET;
  const supplied = request.headers.get("x-resulens-matching-worker");
  if (!configured || !supplied) return false;
  const expectedBytes = Buffer.from(configured);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function POST(request: Request) {
  if (!hasWorkerSecret(request)) return Response.json({ error: "Not found" }, { status: 404 });

  const body = embeddingWorkerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid worker request" }, { status: 400 });

  const workerId = z.string().uuid().safeParse(request.headers.get("x-resulens-worker-id"));
  const result = await processEmbeddingJob(
    body.data.embeddingJobId,
    workerId.success ? workerId.data : randomUUID(),
  );
  return Response.json(result);
}
