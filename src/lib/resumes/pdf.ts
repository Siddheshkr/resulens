import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

import {
  MAX_RESUME_BYTES,
  MAX_RESUME_PAGES,
  MIN_EXTRACTED_TEXT_CHARACTERS,
} from "@/lib/resumes/constants";

export type PdfFailureCode =
  | "empty_file"
  | "file_too_large"
  | "invalid_mime"
  | "invalid_signature"
  | "too_many_pages"
  | "encrypted_pdf"
  | "malformed_pdf"
  | "processing_timeout";

export class PdfProcessingError extends Error {
  constructor(
    readonly code: PdfFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "PdfProcessingError";
  }
}

export type PdfExtraction = {
  pageCount: number;
  pages: string[];
  text: string;
  requiresVision: boolean;
};

export function assertPdfUpload(input: { bytes: Uint8Array; mimeType: string }) {
  if (input.bytes.byteLength === 0) {
    throw new PdfProcessingError("empty_file", "Choose a PDF file before uploading.");
  }

  if (input.bytes.byteLength > MAX_RESUME_BYTES) {
    throw new PdfProcessingError("file_too_large", "PDF files must be 5 MB or smaller.");
  }

  if (input.mimeType !== "application/pdf") {
    throw new PdfProcessingError("invalid_mime", "Only PDF files can be scanned.");
  }

  const signature = new TextDecoder().decode(input.bytes.slice(0, 5));
  if (signature !== "%PDF-") {
    throw new PdfProcessingError("invalid_signature", "The selected file is not a valid PDF.");
  }
}

export async function extractResumeText(bytes: Uint8Array): Promise<PdfExtraction> {
  assertPdfUpload({ bytes, mimeType: "application/pdf" });

  let document: Awaited<ReturnType<typeof getDocumentProxy>>;

  try {
    document = await getDocumentProxy(bytes, {
      disableAutoFetch: true,
      disableRange: true,
      disableStream: true,
      maxImageSize: 16_000_000,
      stopAtErrors: true,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message.toLowerCase() : "";

    if (
      name === "PasswordException" ||
      message.includes("password") ||
      message.includes("encrypted")
    ) {
      throw new PdfProcessingError(
        "encrypted_pdf",
        "This PDF is password-protected. Remove the password and try again.",
      );
    }

    throw new PdfProcessingError(
      "malformed_pdf",
      "ResuLens could not read this PDF. Try exporting it again as a standard PDF.",
    );
  }

  if (document.numPages > MAX_RESUME_PAGES) {
    await document.cleanup();
    throw new PdfProcessingError("too_many_pages", "PDF files must contain five pages or fewer.");
  }

  try {
    const extracted = await extractText(document, { mergePages: false });
    const pages = extracted.text.map((page) => page.replace(/\s+/g, " ").trim());
    const text = pages.filter(Boolean).join("\n\n").trim();

    return {
      pageCount: extracted.totalPages,
      pages,
      text,
      requiresVision: text.length < MIN_EXTRACTED_TEXT_CHARACTERS,
    };
  } finally {
    await document.cleanup();
  }
}
