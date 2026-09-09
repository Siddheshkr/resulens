import { describe, expect, it } from "vitest";

import { vi } from "vitest";

import { assertPdfUpload, extractResumeText, PdfProcessingError } from "@/lib/resumes/pdf";

vi.mock("server-only", () => ({}));

function syntheticPdf(text: string) {
  const chunks = text.match(/.{1,70}/gu) ?? [text];
  const stream = chunks
    .map((chunk, index) => `BT /F1 12 Tf 72 ${720 - index * 18} Td (${chunk}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = document.length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    document += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(document);
}

describe("resume PDF validation", () => {
  it("rejects invalid upload metadata before parsing", () => {
    expect(() =>
      assertPdfUpload({ bytes: new Uint8Array(), mimeType: "application/pdf" }),
    ).toThrowError(new PdfProcessingError("empty_file", "Choose a PDF file before uploading."));
    expect(() =>
      assertPdfUpload({ bytes: new TextEncoder().encode("hello"), mimeType: "text/plain" }),
    ).toThrowError(new PdfProcessingError("invalid_mime", "Only PDF files can be scanned."));
  });

  it("extracts text with page boundaries from a synthetic text PDF", async () => {
    const result = await extractResumeText(
      syntheticPdf(
        "Synthetic resume - TypeScript engineer with product delivery experience, measurable outcomes, and a documented history of collaborating across design and engineering teams. This synthetic fixture includes enough grounded text to exercise the normal extraction path without using applicant data.",
      ),
    );
    expect(result.pageCount).toBe(1);
    expect(result.pages[0]).toContain("Synthetic resume");
    expect(result.requiresVision).toBe(false);
  });

  it("marks image-only or weak extraction for the bounded vision fallback", async () => {
    const result = await extractResumeText(syntheticPdf("short"));

    expect(result.requiresVision).toBe(true);
  });

  it("rejects malformed PDFs with an actionable code", async () => {
    await expect(
      extractResumeText(new TextEncoder().encode("%PDF-not-a-document")),
    ).rejects.toMatchObject({
      code: "malformed_pdf",
    });
  });
});
