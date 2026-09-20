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
  const [isDragging, setIsDragging] = useState(false);
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

  function handleFileSelection(candidate: File | null | undefined) {
    if (!candidate) return;
    if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF file.");
      return;
    }
    if (candidate.size > MAX_RESUME_BYTES) {
      setError("PDF files must be 5 MB or smaller.");
      return;
    }
    setError(null);
    setFile(candidate);
  }

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
      className="resume-upload-card upload-instrument"
      aria-labelledby="resume-upload-title"
    >
      <div className="upload-heading">
        <p className="signal-label">
          <span className="signal-dot" aria-hidden="true" />
          Private intake
        </p>
        <h2 id="resume-upload-title">Scan a resume</h2>
        <p>
          Upload a PDF up to 5&nbsp;MB and 5 pages. You review the extracted profile before it can
          shape a match.
        </p>
      </div>

      <label
        className={`file-drop ${isDragging ? "file-drop-active" : ""}`}
        htmlFor="resume-file"
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFileSelection(event.dataTransfer.files?.[0]);
        }}
      >
        <span className="file-drop-icon" aria-hidden="true">
          PDF
        </span>
        <span className="file-drop-copy">
          <strong>{file ? file.name : isDragging ? "Drop your PDF here" : "Choose a resume PDF"}</strong>
          <small>
            {file
              ? `${new Intl.NumberFormat("en-IN").format(file.size)} bytes selected`
              : "Private upload · 5 pages maximum · or drag & drop"}
          </small>
        </span>
        <input
          id="resume-file"
          name="resume"
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => handleFileSelection(event.target.files?.[0])}
          disabled={busy}
        />
      </label>

      <label className="consent-row" htmlFor="resume-consent">
        <input
          id="resume-consent"
          className="mt-1 size-4"
          name="ai-processing-consent"
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
        <p className="form-message" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="button-primary upload-submit" type="submit" disabled={busy}>
        {busy ? "Preparing Secure Scan…" : "Upload & Scan"}
      </button>
    </form>
  );
}
