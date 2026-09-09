import { notFound, redirect } from "next/navigation";

import { ResumeReviewClient } from "@/components/resume-review-client";
import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function ResumeReviewPage({ params }: PageProps) {
  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/sign-in?redirect_url=/dashboard");
    }
    throw error;
  }

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .select("id,original_filename,status,processing_stage,page_count,error_message")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (resumeError) {
    throw new Error("Could not load the resume");
  }
  if (!resume) {
    notFound();
  }

  const { data: profile, error: profileError } = await supabase
    .from("resume_profiles")
    .select("profile,status")
    .eq("resume_id", id)
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profileError) {
    throw new Error("Could not load the resume profile");
  }

  return <ResumeReviewClient initialResume={resume} initialProfile={profile} />;
}
