# ResuLens Work Tracker

Last reviewed: 2026-09-20

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

- [ ] Deploy and smoke-test all bounded workers in staging (`process-resumes`, `process-embeddings`, `ingest-jobs`, and `maintain-production`)
  - Owner: unassigned
  - Depends on: separate staging Clerk/Supabase/OpenAI/provider credentials, funded OpenAI API usage, a reachable staging app URL, and worker secrets; the linked project currently has only `ingest-jobs` deployed, while the resume, embedding, and maintenance workers remain to deploy
  - Verify: synthetic text/scanned resume workflow, ingestion, matching, stalled-task recovery, retention expiry, and no sensitive logs

- [ ] Configure Sentry dashboards and alerts for staging and production
  - Owner: unassigned
  - Depends on: Sentry projects, DSNs, source-map auth token, and reviewed alert thresholds
  - Verify: a synthetic scrubbed event arrives; alerts cover failed/stalled work, stale sources, Clerk errors, incomplete deletion, and AI spend

- [ ] Run the complete staging journey and record latency/cost evidence
  - Owner: unassigned
  - Depends on: deployed workers and synthetic staging fixtures
  - Verify: Clerk login → upload → processing → correction → approval → matches → save/apply → deletion, including forced retry and Storage verification

- [ ] Production launch approval and rollback rehearsal
  - Owner: unassigned
  - Depends on: [docs/operations/launch-checklist.md](docs/operations/launch-checklist.md) with every blocking item evidenced
  - Verify: Vercel production deployment, scheduled Edge Functions, migration record, backup/PITR check, alert links, and rollback target

- [x] Push the Phase 1–4 audit fixes and verify GitHub Actions from a clean checkout — 2026-09-11
  - Evidence: commit `9550c41` is on `main` and `origin/main`.
  - Verification: GitHub Actions run `34556529026` completed successfully for both quality and database jobs; the local pgTAP mirror remains Docker-dependent.

- [ ] Run a real Clerk email/Google OAuth and webhook delivery smoke test
  - Owner: unassigned
  - Depends on: a Clerk test account, enabled providers, and the deployed webhook URL
  - Verify: sign-in, sign-up, sign-out, and `user.deleted` delivery complete against the configured Clerk instance without exposing secrets

- [ ] Configure and smoke-test the Phase 2 worker path
  - Owner: unassigned
  - Depends on: the applied Phase 2 migration, funded OpenAI API usage, worker secret, deployed app URL, and a synthetic PDF
  - Verify: signed upload, completion, bounded worker processing, profile review, approval, retry, refresh, and deletion complete without raw resume content in logs
  - Progress (2026-09-15): the Docker-free local runner (`npm run worker:local:watch`) now consumes the same private queue and invokes the existing localhost processor; a real local upload completed extraction and reached `needs_review` with a draft profile. Approval, embedding, and deletion still need to be exercised from the signed-in UI.
  - Browser verification (2026-09-16): authenticated dashboard upload validation, approved resume review/edit navigation, and settings retention controls were exercised locally. No destructive resume or account deletion was invoked.

- [ ] Configure and smoke-test the Phase 3 job ingestion worker
  - Owner: unassigned
  - Depends on: provider credentials, one or more curated board/site rows, `JOB_INGESTION_SECRET`, and a deployed app URL
  - Verify: a synthetic or permitted provider run is idempotent, partial provider failure is isolated, stale jobs expire only after a complete run, and `/dashboard/jobs` shows normalized listings without raw payloads
  - Progress (2026-09-15): local-first workflow is verified independently of Vercel. `.env.local` contains the Supabase service-role key, worker secret, and Adzuna credentials; localhost health returns 200; a local bounded ingestion run completed `partial` with 5 pages, 100 records seen/upserted, and 0 failures; hosted data now has 101 active postings; and `/dashboard/jobs` renders the normalized listings. Hosted `ingest-jobs` Edge Function version 4 is active and Vault secrets are configured; its six-hour cron is intentionally paused while deployment verification is deferred until the Vercel Production service-role variable is corrected.
  - Browser verification (2026-09-16): `/dashboard/jobs` showed 40 active listings; Angular search, country/workplace filtering, intentional empty state, source links, and an internal job-detail route were exercised locally.

- [ ] Configure and smoke-test the Phase 4 embedding and matching worker
  - Owner: unassigned
  - Depends on: hosted Phase 4 migrations, funded OpenAI API usage, `MATCHING_WORKER_SECRET`, a reachable deployed app URL, and synthetic approved resume/job rows
  - Verify: resume and job queue messages are processed with bounded retries, stale/deleted revisions cannot write vectors, a match run reaches `succeeded`, top-ten explanations cache safely, and no applicant content appears in logs
  - Progress (2026-09-16): after provider credits were added, a one-token non-sensitive `text-embedding-3-small` probe succeeded. Clicking Retry Matches and running the Docker-free local worker completed the approved resume embedding plus five job embeddings; the latest authenticated match run reached `succeeded` with 4 candidates, and the browser showed four ranked opportunities with no console errors. Remaining job embeddings are intentionally processed in bounded batches to conserve credits; hosted worker deployment, explanations, and the full provider smoke gate remain outstanding.
  - Browser verification (2026-09-16): match refresh, details, save → dismissed → applied → saved transitions, relevance feedback replacement, and cached top-ten explanations were exercised locally; the ranked feed remained visible throughout.

- [ ] Resolve intermittent Clerk hosted-bundle loading in the local browser environment
  - Owner: unassigned
  - Depends on: Clerk CDN/network availability in the affected browser context
  - Verify: a fresh signed-out browser loads the Clerk form without a hosted-bundle error; the existing bounded timeout and Retry fallback remain the safe failure path.
  - Progress (2026-09-16): the fallback is working and the form eventually renders when the Clerk bundle responds, but a fresh Brave context intermittently reports `failed_to_load_clerk_js`. This is an external Clerk delivery/connectivity issue, not a route authorization failure; no credentials were changed.
  - Progress (2026-09-20): the separate page-focus session-touch failure is contained in local development through Clerk's supported `touchSession` option; a fresh local tab waited 12 seconds without a Clerk touch error. Initial hosted-bundle delivery remains dependent on Clerk/browser connectivity.

- [ ] Run the paid-provider release gate for embeddings and explanations
  - Owner: unassigned
  - Depends on: worker smoke test and an approved synthetic evaluation corpus
  - Verify: model latency/token cost, explanation failure fallback, provider rate limits, and HNSW query performance are recorded before enabling public processing

## Next

- [ ] Replace the process-local upload/retry limiter with distributed rate limiting before public beta
  - Owner: unassigned
  - Depends on: Upstash Redis/Ratelimit deployment decision
  - Verify: limits hold across multiple app instances without logging identifiers or resume content

- [ ] Add representative extraction evaluation fixtures and lock the production model snapshot
  - Owner: unassigned
  - Depends on: synthetic text/scanned resume corpus and provider budget
  - Verify: schema validity, evidence grounding, confidence calibration, latency, and token-cost baseline are recorded

## Later

- [ ] Add public-endpoint rate limiting
- [ ] Add distributed public-endpoint rate limiting with an environment-specific Upstash deployment

## Blocked

No current source-level blocker. Local Docker is optional for this developer workflow because the linked hosted pgTAP suites run transactionally and roll back their synthetic fixtures; GitHub Actions remains the clean-checkout local-stack gate after these fixes are pushed.

When adding a blocker, use this form:

```text
- [ ] Blocked outcome
  - Blocked since: YYYY-MM-DD
  - Reason: concise factual blocker
  - Needs: decision, credential, provider response, or external state change
```

## Completed

- [x] Contain transient Clerk session-touch failures during local development — 2026-09-20
  - Evidence: `src/app/layout.tsx` passes `touchSession={false}` outside production and keeps the default Clerk activity touch enabled for production builds.
  - Verification: Node 24 strict type-check passed; a fresh local Brave tab loaded the public app and remained free of Clerk `sessions/.../touch` errors for 12 seconds. The signed-out auth route remained reachable without the Next.js runtime overlay.

- [x] Keep landing and navigation actions stable while Clerk restores a session — 2026-09-20
  - Evidence: `LandingActions` and the authenticated navigation use `useAuth({ treatPendingAsSignedOut: false })`; credentialed landing requests receive Clerk auth state through `src/proxy.ts`; auth forms fall back to `/dashboard` after completion.

- [x] Replace the faded Clerk account popover with a native ResuLens account menu — 2026-09-20
  - Evidence: `src/components/account-menu.tsx` owns the accessible dark menu with Settings, account security, and sign-out actions; the primary navigation no longer duplicates Settings.
  - Verification: local authenticated browser showed the opaque charcoal menu, confirmed no workspace action is present, navigated Settings successfully, and closed the menu with Escape after arrow-key navigation. Lint and strict type-check passed.
  - Verification: a signed-in localhost refresh rendered only `Open Your Workspace` and the user menu in the first accessibility snapshot; clicking the CTA opened `/dashboard`; direct `/sign-in` and `/sign-up` returned to `/dashboard`; Node 24 lint, strict type-check, 49 unit tests, production build, and 26 desktop/mobile Playwright checks passed.

- [x] Add the selected ResuLens brand mark to product and authentication navigation — 2026-09-15
  - Evidence: supplied resume/profile/lens artwork is served from `public/brand/resulens-logo.png`; the shared logo component frames the visible glyph so the export canvas does not create a false gap before the wordmark.
  - Verification: repository-wide `npm run format:check`, `npm run lint`, `npm run typecheck`, and `git diff --check` pass.

- [x] Close source-level Phase 1–5 audit defects and harden the hosted schema — 2026-09-11
  - Evidence: first-visit profile initialization now works on Dashboard, Settings, account APIs, and resume upload; worker secrets use one constant-time verifier; ingestion requests have bounded Zod validation; ranked matches collapse likely cross-provider duplicates; direct profile deletion and deletion-state edits are no longer available to authenticated browser sessions.
  - Verification: Node 24 formatting, lint, strict TypeScript, 45 Vitest tests, production build, dependency audit, and 26 desktop/mobile Playwright checks pass. Hosted migration `20260911022141_phase_completion_hardening` is applied; profile, job, and matching pgTAP suites reach `ok 8`, `ok 12`, and `ok 20`; Supabase security advisors report no findings. A synthetic live OpenAI request reached the provider but was rejected with `credit_balance_exhausted`, so paid worker verification remains in Now.

- [x] Remove opaque applicant/job identifiers from worker response payloads — 2026-09-15
  - Evidence: `process-resumes` and `process-embeddings` now return status-only result entries; scheduler responses do not need identifiers.
  - Verification: Node 24 formatting, lint, strict TypeScript, 47 Vitest tests, production build, and 26 desktop/mobile Playwright checks pass after the change.

- [x] Make worker recovery and account deletion claims race-safe — 2026-09-15
  - Evidence: resume and embedding retry resets require the current worker lock; duplicate Clerk deletion signals preserve a fresh cleanup claim instead of starting a second worker.
  - Verification: Node 24 formatting, lint, strict TypeScript, 47 Vitest tests, production build, and 26 desktop/mobile Playwright checks pass.

- [x] Establish and apply the ResuLens interface system across the application — 2026-09-10
  - Evidence: `design.md` adapts the supplied Framer analysis into ResuLens-specific color, type, layout, component, responsive, content, and accessibility rules; the landing, navigation, Clerk auth, dashboard, upload, resume review, job feed/detail, and match feed now use the same dark instrument system.
  - Verification: Node 24 formatting, lint, strict TypeScript, unit tests, production build, and Playwright checks pass; signed-in landing, dashboard, jobs, and matches were visually reviewed at desktop and mobile widths with no application console errors.

- [x] Define the initial ResuLens product, workflow, stack, architecture, security boundaries, and delivery plan — 2026-09-08
  - Evidence: `context.md`

- [x] Add repository-wide implementation and verification guidance — 2026-09-08
  - Evidence: `AGENTS.md`

- [x] Add the resume-to-job Mermaid workflow to the architecture context — 2026-09-08
  - Evidence: `context.md` under Core User Workflow

- [x] Scaffold the pinned Phase 1 application and toolchain — 2026-09-08
  - Evidence: `.nvmrc`, `package.json`, `package-lock.json`, Next.js App Router routes, strict TypeScript, Tailwind 4, Vitest, Playwright, ESLint, Prettier, and `.github/workflows/ci.yml`
  - Verification: current local re-run on Node 24: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (10 passed), `npm run build`, and `npm run test:e2e` (6 passed)

- [x] Configure Clerk authentication and the protected application shell — 2026-09-08
  - Evidence: `src/proxy.ts`, `requireUser()`, Clerk sign-in/sign-up routes, signed-in navigation, `/dashboard`, and verified Clerk webhook handler
  - Verification: `clerk doctor --json` passed; public landing, health, and unauthenticated dashboard redirect Playwright checks passed

- [x] Create the ResuLens Supabase project, profile schema, generated types, and RLS foundation — 2026-09-08
  - Evidence: Supabase project `resulens`, migrations in `supabase/migrations/`, pgTAP fixture in `supabase/tests/`, and generated `src/lib/supabase/database.types.ts`
  - Verification: hosted migrations applied; security/performance advisors returned no lints; hosted `profiles_rls.test.sql` passes all 8 assertions through the linked SQL runner with synthetic rows rolled back; transactional checks confirmed same-user visibility, cross-user denial, anonymous denial, and ownership-reassignment denial

- [x] Define the Clerk-to-Supabase environment and local provider contract — 2026-09-08
  - Evidence: `.env.example`, server/browser Supabase clients using Clerk `accessToken`, `supabase/config.toml` third-party provider placeholder, and README setup instructions
  - Verification: server Supabase unit test confirms the Clerk token callback; no credentials are tracked

- [x] Activate the hosted Supabase third-party Clerk connection — 2026-09-08
  - Evidence: Supabase Dashboard for project `resulens` shows Clerk enabled for the development domain `grown-bass-4061.clerk.accounts.dev`
  - Verification: the connection appears as `ENABLED` under Authentication → Sign In / Providers → Third-Party Auth

- [x] Activate Clerk's Supabase session integration for the development instance — 2026-09-09
  - Evidence: Clerk Dashboard → Connect Clerk with Supabase reports the ResuLens development integration as `Enabled` and Supabase reports the Clerk provider as `ENABLED`
  - Verification: Clerk now adds the Supabase-compatible role claim to new session tokens; existing browser sessions must refresh or sign in again

- [x] Add Phase 1 documentation and repository operating guidance — 2026-09-08
  - Evidence: updated `context.md`, `AGENTS.md`, `README.md`, and this status tracker

- [x] Fix Clerk auth form visibility and establish the dark-only product shell — 2026-09-09
  - Evidence: dedicated `/sign-in` and `/sign-up` route links, Clerk-hosted account UI with namespaced appearance classes, scoped dark form styling, skip link, dark dashboard, responsive auth layout, explicit Clerk failure/retry state, and a bounded loading timeout
  - Verification: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (10 passed), `npm run build`, and `npm run test:e2e` (6 passed); the local sign-in and sign-up forms render with Google/email options

- [x] Make local Clerk auth resilient to public-route middleware and host binding issues — 2026-09-09
  - Evidence: public routes bypass the server-side Clerk middleware round trip; protected dashboard/private API paths remain protected; anonymous private API requests receive an internal signed-out auth context without a Clerk handshake; `npm run dev` uses the stable webpack path and binds IPv4 loopback, while `npm run dev:lan` is available for LAN testing
  - Verification: `/api/health` responds, `/api/private` returns 401, `/sign-in` renders the Clerk card, and `/dashboard` still redirects unauthenticated users in Playwright

- [x] Make Clerk webhook cleanup retryable and private API authorization explicit — 2026-09-09
  - Evidence: duplicate webhook deliveries with an unfinished `processed_at` record retry profile deletion; `/api/private` re-checks `requireUser()` and returns a safe 401 response
  - Verification: webhook retry/idempotency unit tests and private API unit test pass; full Vitest suite reports 10 passing tests

- [x] Remove the vulnerable bundled Clerk UI dependency and verify the production dependency audit — 2026-09-09
  - Evidence: `@clerk/ui` was removed; Clerk-hosted UI is loaded by `ClerkProvider`, and custom appearance classes no longer depend on Clerk's internal DOM class names
  - Verification: `npm audit --omit=dev --audit-level=high` reports `found 0 vulnerabilities`; `npm ci` remains lockfile-backed

- [x] Implement the Phase 2 resume intake, processing, and profile-review source foundation — 2026-09-09
  - Evidence: private signed-upload API, consent/quota/rate checks, `resumes`/`resume_profiles`/`resume_processing_jobs` and `resume_processing` Queue migration, Storage policies, `unpdf` validation and extraction, OpenAI Responses Structured Outputs contract, bounded worker Edge Function, versioned profile edit/approval routes, retry/status polling, deletion cleanup, and dark dashboard review screens
  - Verification: `npm run lint`, `npm run typecheck`, `npm test` (17 passing tests), `npm run build`, and `npm run test:e2e` (7 passing tests); synthetic PDF text/weak-extraction/malformed-PDF and rate-limit tests pass. Hosted migration `20260909102800_create_resume_processing_foundation.sql` is applied to project `resulens`; catalog checks confirm the resume tables, `pgmq`, private Storage bucket, and migration history. Hosted `resumes_rls.test.sql` passes all 11 assertions through the linked SQL runner with synthetic rows rolled back. Live OpenAI/worker smoke testing remains in Now.

- [x] Deploy the hosted Phase 2 schema and ownership indexes — 2026-09-09
  - Evidence: `20260909102800_create_resume_processing_foundation.sql` and `20260909120000_add_resume_ownership_indexes.sql` are applied to the linked `resulens` project.
  - Verification: `supabase db lint --linked` reports no schema errors; advisors report no unindexed foreign keys or security findings. Remaining unused-index notices are expected until real resume/worker traffic exists.

- [x] Verify hosted Phase 1 and Phase 2 RLS policies with Docker-free pgTAP — 2026-09-09
  - Evidence: `supabase/tests/profiles_rls.test.sql` (8 assertions) and `supabase/tests/resumes_rls.test.sql` (11 assertions) executed against the linked `resulens` project with `finish(true)`.
  - Verification: all assertions passed; synthetic profile, resume, and job rows were confirmed absent after each transaction. Local pgTAP remains a Docker-dependent check only.

- [x] Implement the Phase 3 normalized job schema and provider adapters — 2026-09-09
  - Evidence: `job_sources`, `companies`, `job_postings`, `job_skills`, `ingestion_runs`, private raw-payload storage, shared adapter contract, Adzuna/Greenhouse/Lever adapters, bounded retrying fetch, idempotent ingestion service, internal worker route, `ingest-jobs` Edge Function, authenticated `/dashboard/jobs` feed, and job RLS test coverage.
  - Verification: 21 Vitest tests pass, including HTML sanitization, provider validation, pagination, retry behavior, and safe normalization. Hosted migrations `20260909165339`, `20260909165456`, `20260909170206`, and `20260909170637` are applied; security advisors report no findings, and the remaining performance notices are expected unused-index INFO entries before ingestion traffic. Hosted RLS pgTAP verification also passes through the linked Supabase SQL runner with synthetic data rolled back; local pgTAP execution remains blocked by the unavailable local Postgres service.

- [x] Verify hosted Phase 3 RLS policies with Docker-free pgTAP — 2026-09-09
  - Evidence: `supabase/tests/jobs_rls.test.sql` executed against the linked `resulens` project after enabling the `pgtap` extension; `finish(true)` returned successfully for the 12 planned assertions.
  - Verification: synthetic source, company, job, skill, and private-payload rows were confirmed absent after the transaction, proving the test cleanup rollback.

- [x] Implement Phase 4 embedding, matching, explanations, and job actions — 2026-09-10
  - Evidence: `20260909182331_phase4_matching_foundation.sql`, `20260909185331_phase4_matching_hardening.sql`, `20260909185640_phase4_pending_run_index.sql`, private embedding queue/worker, deterministic scoring service, protected matching/preferences/job APIs, `/dashboard/matches`, and job detail UI.
  - Verification: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test` (28 passing tests), `npm run build`, and `npm run test:e2e` (11 passing tests). The synthetic ranking fixture passes precision@10/nDCG@10 and hard-conflict gates.

- [x] Verify hosted Phase 4 RLS and schema advisors — 2026-09-10
  - Evidence: `supabase/tests/matching_rls.test.sql` with 18 synthetic assertions, all rows rolled back; linked migrations applied to `resulens`.
  - Verification: hosted transaction runner returned `ok 18`; `supabase db lint --linked --schema public --fail-on error` and `supabase db advisors --linked --type all --level error --fail-on error` returned no issues. Local `npm run test:db` remains an optional Docker-backed mirror.

- [x] Audit and harden the Phase 1–4 implementation — 2026-09-10
  - Evidence: fixed Clerk-authenticated local routing across `localhost` and `127.0.0.1`; made local Supabase CI independent of placeholder OIDC discovery; bounded embedding-worker retry persistence; added conditional worker locking; prevented cross-user/cross-job match references in application and database layers; reduced match polling below its rate limit; recorded explanation latency/status; restored editing of approved profile versions; and suppressed root hydration noise introduced by browser extensions.
  - Verification: Node 24 `npm run format:check`, `npm run lint`, `npm run typecheck`, 31 Vitest tests, production build, and 11 Playwright tests pass. Signed-in Dashboard, Jobs, and Matches pages render in Brave. Hosted migration histories are synchronized through `20260910074007`; matching pgTAP reaches `ok 20`, linked database lint reports no errors, security advisors report no findings, and the production dependency audit reports zero vulnerabilities.

- [x] Implement Phase 5 application readiness and recovery foundations — 2026-09-10
  - Evidence: onboarding and settings surfaces, selectable raw-PDF retention, account deletion ledger and write-blocking triggers, Clerk session revocation/deletion orchestration, expired-file cleanup, stalled resume/embedding recovery, aggregate operations endpoint, AI cost tracking hooks, Sentry PII scrubbing, global error recovery, mobile Playwright project, and operations/launch documentation.
  - Verification: `npm run format:check`, `npm run lint`, `npm run typecheck`, 36 Vitest tests, production build, 13 desktop/protected-route Playwright tests, hosted Phase 5 pgTAP transaction (8 assertions), hosted security advisor with no lints, and `npm audit --omit=dev --audit-level=high` with 0 vulnerabilities.
  - Limitation: live staging workers, provider smoke tests, Sentry dashboard delivery, full authenticated E2E deletion, and production deployment remain in Now and are not marked complete.

- [x] Apply and type-sync the Phase 5 hosted migration — 2026-09-10
  - Evidence: linked development project `resulens` migration `20260910093759_phase5_production_readiness`, generated public database types, account cleanup table, retention columns, cost columns, and service-role operational snapshot function.
  - Verification: hosted transaction tests pass with synthetic rows rolled back; hosted security advisor reports no findings. Performance advisor shows only expected unused-index INFO entries before worker traffic.
