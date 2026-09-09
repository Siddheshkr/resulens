"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@clerk/nextjs";

import { MAX_RESUME_BYTES } from "@/lib/resumes/constants";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function ResumeUploadCard() {
  const router = useRouter();
  const { session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      return null;
    }

    return createBrowserSupabaseClient(() => session?.getToken() ?? Promise.resolve(null));
  }, [session]);

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!file || file.type !== "application/pdf") {
      setError("Choose a PDF file.");
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setError("PDF files must be 5 MB or smaller.");
      return;
    }
    if (!consent) {
      setError("Consent is required before ResuLens can process your resume.");
      return;
    }
    if (!supabase) {
      setError(
        "Supabase browser configuration is missing. Add the public values from .env.example.",
      );
      return;
    }

    setBusy(true);
    try {
      const createResponse = await fetch("/api/resumes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          byteSize: file.size,
          aiProcessingConsent: consent,
        }),
      });
      const createPayload = (await createResponse.json()) as {
        error?: string;
        resume?: { id: string };
        upload?: { path: string; token: string };
      };
      if (!createResponse.ok || !createPayload.resume || !createPayload.upload) {
        throw new Error(createPayload.error ?? "Could not start the upload.");
      }

      setMessage("Uploading your private PDF…");
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .uploadToSignedUrl(createPayload.upload.path, createPayload.upload.token, file, {
          contentType: "application/pdf",
        });
      if (uploadError) {
        throw new Error("The PDF upload failed. Try again.");
      }

      setMessage("Upload complete. Queuing the secure scan…");
      const completeResponse = await fetch(`/api/resumes/${createPayload.resume.id}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ byteSize: file.size }),
      });
      const completePayload = (await completeResponse.json()) as { error?: string };
      if (!completeResponse.ok) {
        throw new Error(completePayload.error ?? "The PDF could not be queued.");
      }

      router.push(`/dashboard/resumes/${createPayload.resume.id}`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "The upload failed. Try again.",
      );
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submitUpload}
      className="resume-upload-card"
      aria-labelledby="resume-upload-title"
    >
      <div>
        <p className="eyebrow">Private intake</p>
        <h2
          id="resume-upload-title"
          className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--foreground)]"
        >
          Scan a resume
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
          Upload a PDF up to 5 MB and 5 pages. ResuLens extracts a draft profile for you to review
          before matching.
        </p>
      </div>

      <label
        className="mt-6 block text-sm font-semibold text-[var(--foreground)]"
        htmlFor="resume-file"
      >
        Resume PDF
        <input
          id="resume-file"
          className="mt-2 block w-full cursor-pointer rounded-xl border border-dashed border-white/20 bg-black/25 px-4 py-4 text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand)] file:px-3 file:py-2 file:text-xs file:font-bold file:text-black"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={busy}
        />
      </label>

      <label
        className="mt-4 flex items-start gap-3 text-sm leading-6 text-[var(--muted)]"
        htmlFor="resume-consent"
      >
        <input
          id="resume-consent"
          className="mt-1 size-4 accent-[var(--brand)]"
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          disabled={busy}
        />
        <span>
          I consent to ResuLens sending the resume content to its configured AI provider for profile
          extraction. I can delete it later.
        </span>
      </label>

      {message ? (
        <p className="mt-4 text-sm text-[#ffad9f]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-[#ff9285]" role="alert">
          {error}
        </p>
      ) : null}

      <button className="header-cta mt-6 min-h-11 px-5" type="submit" disabled={busy}>
        {busy ? "Preparing secure scan…" : "Upload and scan"}
      </button>
    </form>
  );
}
