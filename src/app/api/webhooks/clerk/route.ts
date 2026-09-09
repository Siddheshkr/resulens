import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const ClerkWebhookEventSchema = z.object({
  type: z.string(),
  data: z.object({ id: z.string().min(1) }).optional(),
});

export async function POST(request: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  const eventId = request.headers.get("svix-id");

  if (!secret) {
    return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  if (
    !eventId ||
    !request.headers.get("svix-timestamp") ||
    !request.headers.get("svix-signature")
  ) {
    return Response.json({ error: "Missing webhook signature headers" }, { status: 400 });
  }

  let event: z.infer<typeof ClerkWebhookEventSchema>;

  try {
    const verifiedEvent = await verifyWebhook(request, { signingSecret: secret });
    event = ClerkWebhookEventSchema.parse(verifiedEvent);
  } catch {
    return Response.json({ error: "Invalid webhook request" }, { status: 400 });
  }

  if (event.type !== "user.deleted" || !event.data?.id) {
    return Response.json({ error: "Unsupported webhook event" }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    return Response.json({ error: "Webhook storage is not configured" }, { status: 503 });
  }

  const { error: eventError } = await admin.from("clerk_webhook_events").insert({
    event_id: eventId,
    event_type: event.type,
  });

  if (eventError?.code === "23505") {
    const { data: existingEvent, error: lookupError } = await admin
      .from("clerk_webhook_events")
      .select("processed_at")
      .eq("event_id", eventId)
      .maybeSingle();

    if (lookupError) {
      return Response.json({ error: "Could not inspect webhook state" }, { status: 500 });
    }

    if (existingEvent?.processed_at) {
      return Response.json({ received: true, duplicate: true });
    }
  }

  if (eventError && eventError.code !== "23505") {
    return Response.json({ error: "Could not record webhook" }, { status: 500 });
  }

  const { error: deleteError } = await admin.from("profiles").delete().eq("user_id", event.data.id);

  if (deleteError) {
    return Response.json({ error: "Could not process webhook" }, { status: 500 });
  }

  const { error: processedError } = await admin
    .from("clerk_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);

  if (processedError) {
    return Response.json({ error: "Could not finalize webhook" }, { status: 500 });
  }

  return Response.json({ received: true });
}
