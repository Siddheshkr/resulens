import "server-only";

import { createHash } from "node:crypto";

import type { ResumeProfile } from "@/lib/resumes/profile-schema";

const MAX_CONTENT_CHARACTERS = 8_000;

export type MatchingJob = {
  id: string;
  status: string;
  title: string;
  description: string;
  location_text: string | null;
  country_code: string | null;
  workplace_type: string;
  employment_type: string | null;
  seniority: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  work_authorization_support: string;
  required_experience_min_years: number | null;
  required_experience_max_years: number | null;
  content_fingerprint: string;
  posted_at: string | null;
  source_updated_at: string | null;
};

function normalizeText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function boundedText(value: string) {
  return normalizeText(value).slice(0, MAX_CONTENT_CHARACTERS);
}

export function buildResumeEmbeddingContent(profile: ResumeProfile) {
  const sections = [
    profile.headline ? `Headline: ${profile.headline}` : null,
    profile.roleFamilies.length ? `Role families: ${profile.roleFamilies.join(", ")}` : null,
    profile.seniority !== "unknown" ? `Seniority: ${profile.seniority}` : null,
    profile.skills.length
      ? `Skills: ${profile.skills.map((skill) => skill.name).join(", ")}`
      : null,
    ...profile.experiences.map((experience) => {
      const title = experience.title ? `Title: ${experience.title}` : "Title: unknown";
      const company = experience.company ? `Company: ${experience.company}` : null;
      const bullets = experience.bullets.length ? `Impact: ${experience.bullets.join("; ")}` : null;
      return [title, company, bullets].filter(Boolean).join(" | ");
    }),
    ...profile.education.map((education) =>
      [education.degree, education.field, education.institution].filter(Boolean).join(" "),
    ),
    ...profile.achievements.map((achievement) => `Achievement: ${achievement.statement}`),
  ].filter((section): section is string => Boolean(section));

  // Deliberately omit full name, email, phone, and resume evidence excerpts.
  // The embedding represents professional signal, not contact information or raw PDF text.
  return boundedText(sections.join("\n"));
}

export function buildJobEmbeddingContent(job: MatchingJob, skills: string[]) {
  const salary =
    job.salary_min !== null || job.salary_max !== null
      ? `Salary: ${job.salary_min ?? "unknown"}-${job.salary_max ?? "unknown"} ${job.salary_currency ?? ""}`
      : null;
  const requirements = [
    job.seniority ? `Seniority: ${job.seniority}` : null,
    job.workplace_type ? `Workplace: ${job.workplace_type}` : null,
    job.location_text ? `Location: ${job.location_text}` : null,
    job.employment_type ? `Employment: ${job.employment_type}` : null,
    skills.length ? `Skills: ${skills.join(", ")}` : null,
    salary,
    job.required_experience_min_years !== null
      ? `Minimum experience years: ${job.required_experience_min_years}`
      : null,
  ].filter((section): section is string => Boolean(section));

  return boundedText(
    [`Title: ${job.title}`, ...requirements, `Description: ${job.description}`].join("\n"),
  );
}

export function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function formatPgVector(values: number[]) {
  if (!values.length || values.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding vector is empty or invalid");
  }

  return `[${values.map((value) => Number(value.toFixed(8))).join(",")}]`;
}
