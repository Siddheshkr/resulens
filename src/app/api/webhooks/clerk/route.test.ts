import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "svix";
import { NextRequest } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requestAccountDeletion } from "@/server/accounts/cleanup";

import { POST } from "@/app/api/webhooks/clerk/route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(),
}));
vi.mock("@/server/accounts/cleanup", () => ({
  requestAccountDeletion: vi.fn(),
}));

const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

function signedRequest(eventId: string, payload: string) {
  const timestamp = new Date();
  const webhook = new Webhook(secret);

  return new NextRequest("http://localhost/api/webhooks/clerk", {
    method: "POST",
    body: payload,
    headers: {
      "svix-id": eventId,
      "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "svix-signature": webhook.sign(eventId, timestamp, payload),
    },
  });
}

function createAdminMock(options?: { duplicate?: boolean; processedAt?: string | null }) {
  let insertCall = 0;
  const eventsUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  const eventsSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          processed_at:
            options?.processedAt !== undefined ? options.processedAt : "2026-09-08T00:00:00.000Z",
        },
        error: null,
      }),
    }),
  });
  const admin = {
    from: vi.fn((table: string) => {
      void table;
      return {
        insert: vi.fn().mockImplementation(async () => {
          insertCall += 1;
          return options?.duplicate || insertCall > 1
            ? { error: { code: "23505" } }
            : { error: null };
        }),
        select: eventsSelect,
        update: eventsUpdate,
      };
    }),
  };

  return { admin, eventsSelect, eventsUpdate };
}

describe("POST /api/webhooks/clerk", () => {
  beforeEach(() => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", secret);
    vi.mocked(createAdminSupabaseClient).mockReset();
    vi.mocked(requestAccountDeletion).mockReset().mockResolvedValue({ status: "complete" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects missing signature headers", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/clerk", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing webhook signature headers" });
  });

  it("rejects an invalid signature without touching storage", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/clerk", {
        method: "POST",
        body: JSON.stringify({ type: "user.deleted", data: { id: "user_test_123" } }),
        headers: {
          "svix-id": "msg_invalid",
          "svix-timestamp": Math.floor(Date.now() / 1000).toString(),
          "svix-signature": "v1,invalid",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("processes a valid deletion event and treats a processed retry as idempotent", async () => {
    const { admin, eventsUpdate, eventsSelect } = createAdminMock();
    vi.mocked(createAdminSupabaseClient).mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminSupabaseClient>,
    );
    const payload = JSON.stringify({ type: "user.deleted", data: { id: "user_test_123" } });

    const firstResponse = await POST(signedRequest("msg_valid", payload));
    const secondResponse = await POST(signedRequest("msg_valid", payload));

    expect(firstResponse.status).toBe(200);
    await expect(firstResponse.json()).resolves.toEqual({ received: true });
    expect(secondResponse.status).toBe(200);
    await expect(secondResponse.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(requestAccountDeletion).toHaveBeenCalledOnce();
    expect(eventsUpdate).toHaveBeenCalledOnce();
    expect(eventsSelect).toHaveBeenCalledOnce();
  });

  it("retries deletion when an earlier delivery recorded but did not finish", async () => {
    const { admin, eventsUpdate } = createAdminMock({
      processedAt: null,
    });
    vi.mocked(createAdminSupabaseClient).mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminSupabaseClient>,
    );
    vi.mocked(requestAccountDeletion)
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce({ status: "complete" });
    const payload = JSON.stringify({ type: "user.deleted", data: { id: "user_test_123" } });

    const firstResponse = await POST(signedRequest("msg_retry", payload));
    const retryResponse = await POST(signedRequest("msg_retry", payload));

    expect(firstResponse.status).toBe(500);
    expect(retryResponse.status).toBe(200);
    await expect(retryResponse.json()).resolves.toEqual({ received: true });
    expect(requestAccountDeletion).toHaveBeenCalledTimes(2);
    expect(eventsUpdate).toHaveBeenCalledOnce();
  });
});
