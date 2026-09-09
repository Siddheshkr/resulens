export function sanitizeResumeFilename(filename: string) {
  const basename = filename.replaceAll("\\", "/").split("/").pop() ?? "resume.pdf";
  const normalized = basename
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "-")
    .trim()
    .slice(0, 240);

  if (!normalized.toLowerCase().endsWith(".pdf")) {
    return `${normalized || "resume"}.pdf`;
  }

  return normalized || "resume.pdf";
}
