import { randomUUID } from "node:crypto";

import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  MAX_RESUME_BYTES,
  MAX_RESUME_BYTES_PER_DAY,
  MAX_RESUME_SCANS_PER_DAY,
} from "@/lib/resumes/constants";
import { createResumeUploadSchema } from "@/lib/resumes/requests";
import { sanitizeResumeFilename } from "@/lib/resumes/filename";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/server/accounts/profile";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

function startOfUtcDay() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export async function GET() {
  try {
    const { userId } = await requireUser();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("resumes")
      .select(
        "id,original_filename,byte_size,status,processing_stage,page_count,latest_profile_version,approved_profile_version,error_code,error_message,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("Could not load resumes");
    }

    return Response.json({ resumes: data ?? [] });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return unauthorized();
    }

    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireUser();
    const body = createResumeUploadSchema.safeParse(await request.json().catch(() => null));

    if (!body.success) {
      return Response.json(
        { error: "Choose a PDF no larger than 5 MB and consent to AI processing." },
        { status: 400 },
      );
    }

    const rate = checkRateLimit(`resume-upload:${userId}`, 3, 60_000);
    if (!rate.allowed) {
      return Response.json(
        { error: "Too many upload attempts. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    if (body.data.byteSize > MAX_RESUME_BYTES) {
      return Response.json({ error: "PDF files must be 5 MB or smaller." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    await ensureUserProfile(supabase, userId);
    const { data: recentResumes, error: quotaError } = await supabase
      .from("resumes")
      .select("byte_size")
      .eq("user_id", userId)
      .gte("created_at", startOfUtcDay());

    if (quotaError) {
      throw new Error("Could not verify the daily scan quota");
    }

    const dailyBytes = (recentResumes ?? []).reduce((total, resume) => total + resume.byte_size, 0);
    if (
      (recentResumes?.length ?? 0) >= MAX_RESUME_SCANS_PER_DAY ||
      dailyBytes + body.data.byteSize > MAX_RESUME_BYTES_PER_DAY
    ) {
      return Response.json(
        { error: "Your daily resume scan limit has been reached. Try again tomorrow." },
        { status: 429 },
      );
    }

    const resumeId = randomUUID();
    const storagePath = `${userId}/${resumeId}.pdf`;
    const { data: resume, error: insertError } = await supabase
      .from("resumes")
      .insert({
        id: resumeId,
        user_id: userId,
        original_filename: sanitizeResumeFilename(body.data.filename),
        storage_path: storagePath,
        mime_type: body.data.mimeType,
        byte_size: body.data.byteSize,
        ai_processing_consent_at: new Date().toISOString(),
      })
      .select("id,original_filename,byte_size,status,processing_stage,created_at")
      .single();

    if (insertError || !resume) {
      throw new Error("Could not create the resume upload");
    }

    try {
      const admin = createAdminSupabaseClient();
      const { data: signedUpload, error: signedUploadError } = await admin.storage
        .from("resumes")
        .createSignedUploadUrl(storagePath, { upsert: false });

      if (signedUploadError || !signedUpload) {
        throw new Error("Could not create a secure upload URL");
      }

      return Response.json(
        {
          resume,
          upload: { path: signedUpload.path, token: signedUpload.token },
        },
        { status: 201 },
      );
    } catch (error) {
      await supabase.from("resumes").delete().eq("id", resumeId).eq("user_id", userId);
      throw error;
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return unauthorized();
    }

    throw error;
  }
}
