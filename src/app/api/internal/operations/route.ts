import { timingSafeEqual } from "node:crypto";

import { getOperationalSnapshot, runMaintenance } from "@/server/operations/maintenance";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.OPERATIONS_WORKER_SECRET;
  const actual = request.headers.get("x-resulens-operations-worker");
  if (!expected || !actual || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getOperationalSnapshot());
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await runMaintenance());
}
