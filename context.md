# ResuLens — Product and Architecture Context

Last reviewed: 2026-09-09

## Product

ResuLens is a resume-first job discovery web application. A user uploads a PDF resume, reviews the structured profile extracted from it, and receives ranked, explainable job matches from approved job APIs and public ATS feeds.

Tagline: **Your resume, focused on the right opportunities.**

ResuLens is a fresh project. Do not copy the old JobSync application or preserve its architecture by default. Reuse a previous idea only after validating that it fits this product and current dependencies.

## Core User Workflow

1. The visitor selects a PDF and signs in before it is uploaded.
2. The browser uploads the PDF directly to a private Supabase Storage bucket through a short-lived signed URL.
3. An asynchronous worker validates the PDF and extracts its text.
4. If normal extraction is insufficient, a bounded vision/file-input fallback processes the scanned pages.
5. OpenAI Structured Outputs converts the extracted content into a validated resume profile.
6. The user reviews and corrects the profile and supplies job preferences.
7. Hard eligibility filters remove unsuitable jobs.
8. PostgreSQL full-text search and pgvector retrieve relevant jobs.
9. A deterministic scoring function ranks the candidates.
10. The LLM explains only the strongest matches using stored evidence.
11. The user saves, dismisses, or visits the canonical source page to apply.

```mermaid
flowchart LR
    A[PDF resume] --> B[Secure validation]
    B --> C[Local text extraction]
    C -->|Good text| D[Structured resume extraction]
    C -->|Scanned or weak text| E[Vision fallback]
    E --> D
    D --> F[User reviews profile]
    F --> G[Resume embedding]

    H[Adzuna API] --> I[Normalize and deduplicate jobs]
    J[Greenhouse boards] --> I
    K[Lever boards] --> I
    I --> L[Job embeddings]

    G --> M[Hard eligibility filters]
    L --> M
    M --> N[Hybrid ranking]
    N --> O[Top matches]
    O --> P[Grounded AI explanation]
    P --> Q[Save / dismiss / apply]
```

## Product Boundaries

### MVP

- Clerk-managed Google OAuth and email authentication
- Private PDF resume upload
- Text extraction with a scanned-PDF fallback
- Structured, editable resume profile
- Job ingestion from Adzuna and curated Greenhouse and Lever boards
- Hybrid job matching and evidence-backed explanations
- Match feed, job detail, saved, dismissed, and applied states
- User preferences and complete data deletion
- Automated ingestion, embedding, retry, and expiry workflows
- Production monitoring without logging resume content

### Not in the MVP

- Automatic job applications
- ATS friendly resume builder
- ATS Score check
- LinkedIn or Indeed scraping
- Browser automation using a user's credentials
- Resume rewriting or cover-letter generation
- Subscription billing
- Recruiter or team dashboards
- Native mobile applications
- A chat-based career agent
- A custom-trained ranking model

## Architecture Principles

- The LLM is not a scraper and does not assign the numeric match score.
- Prefer documented APIs and public ATS feeds over browser scraping.
- Use deterministic filters before semantic retrieval.
- Treat match scores as product rankings, not hiring probabilities or ATS scores.
- Every extracted fact and match explanation must be traceable to source evidence.
- Users must approve or correct extracted profile data before matching.
- Keep route handlers thin; put domain logic in services and persistence in repositories.
- Keep provider-specific job ingestion behind a shared adapter interface.
- Run PDF parsing, AI calls, ingestion, and embedding generation asynchronously with retries.
- Use stable releases only. Do not introduce canary, preview, or experimental dependencies without an accepted design decision.
- Resolve current stable package versions during initial scaffolding and pin the lockfile.

## Initial Technical Baseline

| Area                     | Decision                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Runtime                  | Node.js 24 LTS                                                                                              |
| Web framework            | Next.js 16.3.4 App Router                                                                                   |
| UI runtime               | React and React DOM 19.2.8                                                                                  |
| Language                 | TypeScript 6, strict mode                                                                                   |
| Styling                  | Tailwind CSS 4.3, shadcn/ui, Radix primitives, Lucide icons                                                 |
| Validation               | Zod 4.5                                                                                                     |
| Authentication           | Clerk for users, sessions, Google OAuth, email authentication, and account UI                               |
| Data platform            | Supabase PostgreSQL, Storage, Realtime, Edge Functions, Queues, Cron, and pgvector                          |
| Supabase clients         | `@supabase/supabase-js` with Clerk `accessToken` callbacks; Clerk owns browser and server session lifecycle |
| PDF extraction           | `unpdf`, initially pinned to the latest validated stable release                                            |
| AI                       | Official OpenAI JavaScript SDK and Responses API                                                            |
| Default LLM              | `gpt-5.6-luna`                                                                                              |
| Escalation LLM           | `gpt-5.6-terra` for low-confidence or unusually formatted resumes                                           |
| Embeddings               | `text-embedding-3-small`                                                                                    |
| Unit/integration testing | Vitest 5, React Testing Library, MSW, and pgTAP                                                             |
| End-to-end testing       | Playwright 1.63                                                                                             |
| Hosting                  | Vercel for Next.js; Supabase for data and background workloads                                              |
| Observability            | Sentry and structured, PII-safe logs                                                                        |
| Public endpoint limiting | Upstash Redis/Ratelimit before public beta                                                                  |
| Package manager          | npm with a committed `package-lock.json` and pinned `packageManager` field                                  |

Version numbers above are the approved starting baseline, not permission to skip compatibility checks. Verify current stable patch releases, release notes, and peer-dependency compatibility immediately before scaffolding or upgrading.

### Phase 1 foundation status

- Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS 4, Vitest, Playwright, ESLint, and Prettier are scaffolded with pinned versions and a committed npm lockfile.
- Clerk is the only authentication/session owner. The protected `/dashboard` route and private server resources re-check `auth()`/`requireUser()`; `proxy.ts` is only an early routing check.
- Supabase receives the Clerk session token through `@supabase/supabase-js`. The initial `profiles` and worker-only `clerk_webhook_events` tables use text Clerk subjects and RLS policies based on `((select auth.jwt()) ->> 'sub')`.
- The hosted ResuLens Supabase project has its native Clerk third-party auth connection enabled for the development Clerk domain; the exact domain remains environment-specific and is not committed to local configuration.
- The hosted ResuLens development Supabase project has both Phase 1 migrations applied and passes the Supabase security/performance advisor checks. Local pgTAP execution still requires Docker Desktop or Podman.
- The product shell is dark-only: an obsidian background, warm readable text, ember accent actions, accessible focus states, reduced-motion handling, and no light-theme fallback on public, auth, or protected surfaces.

## AI Contract

Use the OpenAI Responses API with JSON Schema Structured Outputs and `store: false` for resume processing. Keep the API key server-side.

The structured resume profile should include:

- Contact information
- Candidate headline and likely role families
- Employment entries with dates and duration
- Skills with supporting evidence
- Education, certifications, and projects
- Measurable achievements
- Observed locations and estimated seniority
- Total experience
- Per-field confidence and source page/evidence
- Ambiguity and missing-information warnings

Never invent a field. Return an absent or low-confidence value for uncertain information and request user confirmation in the UI.

Use local PDF text extraction first. Send only the required normalized text to the model when possible. For image-only resumes, bound the file size, page count, image resolution, processing time, and memory before using vision/file input.

## Job Ingestion

Initial provider adapters:

- Adzuna for broad keyword/location discovery
- Greenhouse Job Board API for curated employer boards
- Lever Postings API for curated employer boards

All adapters implement the same sequence:

`fetch -> validate -> normalize -> sanitize -> deduplicate -> upsert -> embed -> activate/expire`

Requirements:

- Retain canonical source URLs and required attribution.
- Use `(source_id, external_job_id)` as the primary provider identity.
- Add a content fingerprint to detect duplicate cross-postings.
- Sanitize all provider HTML before displaying it.
- Keep raw provider payloads private and out of client responses.
- Refresh on a configurable schedule, initially every four to six hours.
- Record run status, counts, retry attempts, failures, and rate-limit responses.
- Expire a listing when the source closes it or after the configured stale threshold.

## Matching

Apply hard constraints first: location, work authorization, workplace type, role exclusions, seniority, required experience, and freshness.

Retrieve candidates using PostgreSQL full-text search and pgvector similarity. Start with this scoring model:

| Signal                               | Weight |
| ------------------------------------ | -----: |
| Semantic similarity                  |    40% |
| Required and preferred skill overlap |    25% |
| Role title and seniority             |    15% |
| Location and workplace preference    |    10% |
| Posting freshness                    |     5% |
| Salary preference                    |     5% |

Renormalize weights when optional provider data, such as salary, is unavailable. Do not penalize a candidate for data the provider omitted.

LLM explanations are grounded summaries of calculated evidence. They must distinguish strong matches, transferable strengths, missing requirements, and unknowns.

## Data Model

Expected core tables:

- `profiles`
- `clerk_webhook_events` (worker-only idempotency records)
- `candidate_preferences`
- `resumes`
- `resume_profiles`
- `resume_experiences`
- `resume_skills`
- `companies`
- `job_sources`
- `job_postings`
- `job_skills`
- `ingestion_runs`
- `match_runs`
- `job_matches`
- `job_feedback`
- `processing_failures`

Use relational columns for fields used by filters, joins, authorization, and indexes. JSONB is suitable for private raw provider payloads and infrequently queried metadata, not as a substitute for a deliberate schema.

Expected indexes include:

- B-tree indexes on every RLS ownership/filter column, especially `user_id`
- Unique `(source_id, external_job_id)`
- Indexes for job status, location, workplace type, seniority, and `posted_at`
- GIN full-text indexes on normalized job content
- HNSW vector indexes after representative data and query benchmarks exist

## Security and Privacy Invariants

- Require authentication before uploading resume bytes.
- Store resumes in a private bucket under a user-owned path.
- Validate the PDF signature, MIME type, byte size, page count, encryption state, processing duration, and resource use.
- Default limits are 5 MB and 5 pages until benchmark evidence justifies changes.
- Never execute PDF scripts, expose raw uploads publicly, or parse unbounded content in a request handler.
- Enable RLS on every exposed table and define explicit grants and per-operation policies. For Clerk-backed rows, authorize with the immutable JWT subject claim `((select auth.jwt()) ->> 'sub')`, never editable Clerk metadata.
- Treat Clerk webhook verification and idempotency as reliability infrastructure; do not make authorization correctness depend on webhook delivery.
- Test that users cannot access another user's resume, profile, preferences, matches, feedback, or storage objects.
- Keep service-role, OpenAI, and job-provider credentials server-only; never prefix them with `NEXT_PUBLIC_`.
- Do not place resume text, names, contact data, storage URLs, or model prompts in logs, analytics, traces, or error messages.
- Obtain explicit consent before sending resume information to an AI provider.
- Provide raw-PDF retention controls and complete user-data deletion.
- Rate-limit upload, processing, matching, and feedback endpoints.
- Treat dependency and framework security patches as release-blocking updates.

## Planned Repository Shape

```text
src/
  app/
    (marketing)/
    (auth)/
    (product)/
    api/
  components/
    ui/
    layout/
  features/
    auth/
    resumes/
    jobs/
    matching/
    feedback/
  lib/
    ai/
    database/
    security/
    supabase/
    validation/
  server/
    job-sources/
    matching/
    repositories/
    services/
supabase/
  functions/
  migrations/
  tests/
  seed.sql
tests/
  e2e/
  evals/
  fixtures/
  integration/
```

Do not create layers or folders merely to match this diagram. Add them when an implemented feature has a real owner.

## Quality Gates

Every merge-ready change must pass the checks relevant to its scope:

- Formatting and ESLint
- TypeScript strict type-checking
- Focused unit and integration tests
- Supabase migration reset and pgTAP/RLS tests for database changes
- Production Next.js build
- Playwright tests for affected critical user workflows
- Accessibility checks for changed interactive UI
- Secret and PII review for logging, errors, fixtures, and snapshots

Use synthetic resumes and job descriptions in the repository. Never commit real applicant data.

## MVP Definition of Done

- A user can upload and process a valid one-to-five-page PDF.
- Normal and scanned resume paths have clear success and failure handling.
- Extracted facts are editable and supported by resume evidence.
- Processing failures can be retried and never leave an endless loading state.
- Jobs refresh automatically and duplicates and stale records are controlled.
- Ranking combines eligibility, lexical search, semantic similarity, and freshness.
- Match explanations contain no unsupported claims.
- RLS and storage-isolation tests pass.
- Critical mobile and desktop journeys pass Playwright.
- Critical screens meet WCAG 2.2 AA expectations.
- A user can delete the uploaded resume and all derived private data.

## Delivery Order

1. Initialize Git, Next.js, package pinning, linting, tests, and CI.
2. Create local Supabase configuration, schema migrations, generated types, and RLS tests.
3. Implement authentication, private storage, and direct signed uploads.
4. Implement asynchronous PDF processing and profile review.
5. Implement and verify job-source adapters.
6. Add embeddings, hybrid retrieval, deterministic scoring, and evaluation fixtures.
7. Build match, job detail, save, dismiss, and apply-out workflows.
8. Add monitoring, rate limits, retention/deletion, accessibility, and production deployment.
