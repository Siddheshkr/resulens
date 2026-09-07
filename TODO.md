# ResuLens Work Tracker

Last reviewed: 2026-09-08

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

These tasks form the current implementation milestone. Work roughly from top to bottom.

- [ ] Initialize the ResuLens Git repository and baseline project documentation
  - Owner: unassigned
  - Depends on: none
  - Verify: clean Git status and documented repository setup

- [ ] Scaffold the pinned Node.js, Next.js, React, and TypeScript application
  - Owner: unassigned
  - Depends on: repository initialization
  - Verify: development server starts and production build passes

- [ ] Configure formatting, linting, strict type-checking, unit tests, and CI
  - Owner: unassigned
  - Depends on: application scaffold
  - Verify: all baseline quality scripts pass locally and in CI

- [ ] Initialize the local Supabase project and environment-variable contract
  - Owner: unassigned
  - Depends on: application scaffold
  - Verify: local Supabase stack starts and generated database types succeed

- [ ] Design the initial relational schema and private storage layout
  - Owner: unassigned
  - Depends on: local Supabase project
  - Verify: migration reset succeeds from an empty database

- [ ] Implement authentication, ownership grants, RLS policies, and pgTAP isolation tests
  - Owner: unassigned
  - Depends on: initial schema
  - Verify: authenticated ownership tests pass and cross-user access is denied

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

No known blockers.

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

