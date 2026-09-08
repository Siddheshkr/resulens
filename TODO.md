# ResuLens Work Tracker

Last reviewed: 2026-09-09

This file is the lightweight, repository-level source of truth for planned and completed work. Product and architecture decisions belong in `context.md`; contributor rules belong in `AGENTS.md`; runtime logs belong in the relevant observability system.

## How to Maintain This File

- Keep tasks small enough to have one verifiable outcome.
- Use GitHub issues once collaboration or backlog volume makes this file difficult to review.
- Move a task between sections instead of duplicating it.
- Mark a task complete only after its relevant checks pass.
- Add the completion date and short verification evidence to completed work.
- Link an issue, pull request, commit, migration, or test when one exists.
- Record a blocker with the required decision or external dependency.
- Do not place secrets, personal data, resume content, API responses, or raw logs here.
- Update `Last reviewed` whenever this file is materially reorganized.

Task format:

```text
- [ ] Outcome-oriented task description
  - Owner: unassigned
  - Depends on: none
  - Verify: concrete command or acceptance check
```

Completed task format:

```text
- [x] Outcome that was completed — YYYY-MM-DD
  - Evidence: tests, build, migration, commit, or concise manual verification
```

## Now

- [ ] Run the Phase 1 GitHub Actions workflow from a clean checkout
  - Owner: unassigned
  - Depends on: review and push of the Phase 1 changes
  - Verify: the `quality` and `database` jobs pass with repository-managed secrets/configuration

## Next

- [ ] Implement direct signed uploads to the private resume bucket
  - Owner: unassigned
  - Depends on: authentication, schema, storage policies
  - Verify: valid PDF upload succeeds and cross-user access fails

- [ ] Implement bounded, asynchronous PDF validation and text extraction
  - Owner: unassigned
  - Depends on: private uploads
  - Verify: text PDF, scanned PDF, encrypted PDF, oversized PDF, and malformed PDF fixtures reach the expected states

- [ ] Implement OpenAI Structured Outputs for the resume profile
  - Owner: unassigned
  - Depends on: extracted resume text
  - Verify: synthetic extraction evals pass schema, grounding, and confidence checks

- [ ] Build the extracted-profile review and correction workflow
  - Owner: unassigned
  - Depends on: structured resume extraction
  - Verify: user can correct, approve, and persist every supported profile section

- [ ] Implement the shared job-source adapter contract
  - Owner: unassigned
  - Depends on: initial job schema
  - Verify: sanitized provider fixtures satisfy the shared contract tests

- [ ] Implement Adzuna, Greenhouse, and Lever ingestion adapters
  - Owner: unassigned
  - Depends on: provider adapter contract
  - Verify: pagination, rate limiting, retries, deduplication, and partial-provider failure tests pass

- [ ] Implement job and resume embedding workflows
  - Owner: unassigned
  - Depends on: normalized jobs and approved resume profiles
  - Verify: queued embeddings retry safely and remain synchronized after content changes

- [ ] Implement hard filters, hybrid retrieval, and deterministic scoring
  - Owner: unassigned
  - Depends on: embeddings and candidate preferences
  - Verify: ranking unit tests and representative precision-at-10/nDCG evaluation pass the agreed baseline

## Later

- [ ] Build the match feed and job detail experience
- [ ] Add evidence-grounded match explanations
- [ ] Add save, dismiss, applied, and feedback workflows
- [ ] Add public-endpoint rate limiting
- [ ] Add Sentry with PII-safe error and performance reporting
- [ ] Add automated raw-resume retention and complete account deletion
- [ ] Complete mobile, accessibility, failure-state, and no-sensitive-log testing
- [ ] Create staging and production deployment environments
- [ ] Define launch readiness, support, and incident procedures

## Blocked

- [ ] Run local Supabase pgTAP tests
  - Blocked since: 2026-09-08
  - Reason: `npm run test:db` cannot connect to the local Postgres service at `127.0.0.1:54322`; Docker Desktop or Podman is not installed/running in this environment.
  - Needs: Docker Desktop or Podman, then `supabase start` and `npm run test:db`

- [ ] Review transitive `@clerk/ui` audit advisories before production
  - Blocked since: 2026-09-09
  - Reason: `npm audit --omit=dev --audit-level=high` reports 7 high and 13 moderate advisories in Clerk UI's wallet/React Native dependency graph; the automatic forced fix would downgrade the pinned Clerk UI package.
  - Needs: upstream remediation or an explicit decision to use Clerk's unpinned hosted UI layer

When adding a blocker, use this form:

```text
- [ ] Blocked outcome
  - Blocked since: YYYY-MM-DD
  - Reason: concise factual blocker
  - Needs: decision, credential, provider response, or external state change
```

## Completed

- [x] Define the initial ResuLens product, workflow, stack, architecture, security boundaries, and delivery plan — 2026-09-08
  - Evidence: `context.md`

- [x] Add repository-wide implementation and verification guidance — 2026-09-08
  - Evidence: `AGENTS.md`

- [x] Add the resume-to-job Mermaid workflow to the architecture context — 2026-09-08
  - Evidence: `context.md` under Core User Workflow

- [x] Scaffold the pinned Phase 1 application and toolchain — 2026-09-08
  - Evidence: `.nvmrc`, `package.json`, `package-lock.json`, Next.js App Router routes, strict TypeScript, Tailwind 4, Vitest, Playwright, ESLint, Prettier, and `.github/workflows/ci.yml`
  - Verification: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` (3 passed)

- [x] Configure Clerk authentication and the protected application shell — 2026-09-08
  - Evidence: `src/proxy.ts`, `requireUser()`, Clerk sign-in/sign-up routes, signed-in navigation, `/dashboard`, and verified Clerk webhook handler
  - Verification: `clerk doctor --json` passed; public landing, health, and unauthenticated dashboard redirect Playwright checks passed

- [x] Create the ResuLens Supabase project, profile schema, generated types, and RLS foundation — 2026-09-08
  - Evidence: Supabase project `resulens`, migrations in `supabase/migrations/`, pgTAP fixture in `supabase/tests/`, and generated `src/lib/supabase/database.types.ts`
  - Verification: hosted migrations applied; security/performance advisors returned no lints; transactional checks confirmed same-user visibility, cross-user denial, anonymous denial, and ownership-reassignment denial

- [x] Define the Clerk-to-Supabase environment and local provider contract — 2026-09-08
  - Evidence: `.env.example`, server/browser Supabase clients using Clerk `accessToken`, `supabase/config.toml` third-party provider placeholder, and README setup instructions
  - Verification: server Supabase unit test confirms the Clerk token callback; no credentials are tracked

- [x] Activate the hosted Supabase third-party Clerk connection — 2026-09-08
  - Evidence: Supabase Dashboard for project `resulens` shows Clerk enabled for the development domain `grown-bass-4061.clerk.accounts.dev`
  - Verification: the connection appears as `ENABLED` under Authentication → Sign In / Providers → Third-Party Auth

- [x] Add Phase 1 documentation and repository operating guidance — 2026-09-08
  - Evidence: updated `context.md`, `AGENTS.md`, `README.md`, and this status tracker

- [x] Fix Clerk auth form visibility and establish the dark-only product shell — 2026-09-09
  - Evidence: dedicated `/sign-in` and `/sign-up` route links, Clerk loading states, pinned `@clerk/ui`, scoped dark form styling, skip link, dark dashboard, and responsive auth layout
  - Verification: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (7 passed), `npm run build`, and `npm run test:e2e` (5 passed)
