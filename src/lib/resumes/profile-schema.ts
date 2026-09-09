import { z } from "zod";

const evidenceSchema = z.object({
  page: z.number().int().min(1).max(5),
  excerpt: z.string().trim().max(500),
});

const confidenceSchema = z.number().min(0).max(1);

const experienceSchema = z.object({
  company: z.string().trim().max(160).nullable(),
  title: z.string().trim().max(160).nullable(),
  startDate: z.string().trim().max(40).nullable(),
  endDate: z.string().trim().max(40).nullable(),
  location: z.string().trim().max(160).nullable(),
  bullets: z.array(z.string().trim().max(500)).max(12),
  evidence: z.array(evidenceSchema).max(8),
  confidence: confidenceSchema,
});

const educationSchema = z.object({
  institution: z.string().trim().max(200).nullable(),
  degree: z.string().trim().max(160).nullable(),
  field: z.string().trim().max(160).nullable(),
  endDate: z.string().trim().max(40).nullable(),
  evidence: z.array(evidenceSchema).max(5),
  confidence: confidenceSchema,
});

const skillSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().max(80).nullable(),
  evidence: z.array(evidenceSchema).max(5),
  confidence: confidenceSchema,
});

const achievementSchema = z.object({
  statement: z.string().trim().max(500),
  evidence: z.array(evidenceSchema).max(5),
  confidence: confidenceSchema,
});

export const resumeProfileSchema = z.object({
  fullName: z.string().trim().max(160).nullable(),
  headline: z.string().trim().max(200).nullable(),
  email: z.string().trim().max(320).nullable(),
  phone: z.string().trim().max(80).nullable(),
  locations: z.array(z.string().trim().max(160)).max(10),
  roleFamilies: z.array(z.string().trim().max(120)).max(10),
  seniority: z.enum([
    "intern",
    "junior",
    "mid",
    "senior",
    "lead",
    "principal",
    "executive",
    "unknown",
  ]),
  totalExperienceYears: z.number().min(0).max(80).nullable(),
  skills: z.array(skillSchema).max(80),
  experiences: z.array(experienceSchema).max(30),
  education: z.array(educationSchema).max(20),
  achievements: z.array(achievementSchema).max(30),
  warnings: z.array(z.string().trim().max(300)).max(20),
});

export type ResumeProfile = z.infer<typeof resumeProfileSchema>;
export type ResumeEvidence = z.infer<typeof evidenceSchema>;

export function calculateAverageConfidence(profile: ResumeProfile) {
  const values = [
    ...profile.skills.map((skill) => skill.confidence),
    ...profile.experiences.map((experience) => experience.confidence),
    ...profile.education.map((education) => education.confidence),
    ...profile.achievements.map((achievement) => achievement.confidence),
  ];

  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(4));
}

export const emptyResumeProfile: ResumeProfile = {
  fullName: null,
  headline: null,
  email: null,
  phone: null,
  locations: [],
  roleFamilies: [],
  seniority: "unknown",
  totalExperienceYears: null,
  skills: [],
  experiences: [],
  education: [],
  achievements: [],
  warnings: [],
};
