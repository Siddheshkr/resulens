# ResuLens

ResuLens is a resume-first job discovery application. Phases 1–5 provide Clerk authentication, private resume processing, normalized job ingestion, deterministic matching, retention controls, coordinated deletion, and opt-in production monitoring.

## Requirements

- Node.js 24 LTS (`.nvmrc`)
- npm 11 (recorded in `package.json`)
- A Clerk development instance
- A Supabase project configured with Clerk as its third-party authentication provider
- Docker Desktop or Podman only if running Supabase pgTAP locally; the linked hosted test workflow is the Docker-free alternative

## Local setup

1. Install the pinned Node runtime and dependencies:

   ```bash
   nvm use
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and fill the values from Clerk and Supabase. `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` are server-only; never expose them as `NEXT_PUBLIC_*` variables.

3. In Clerk, enable Google OAuth and email authentication, then configure a webhook for `POST /api/webhooks/clerk` with the `user.deleted` event. Store the endpoint's Svix signing secret as `CLERK_WEBHOOK_SIGNING_SECRET`.

4. In Supabase, enable the native Clerk third-party provider with the exact Clerk instance domain. Apply the migrations using the Supabase CLI or the hosted migration workflow:

   ```bash
   supabase db reset
   npm run test:db
   ```

   The tracked local config disables Clerk OIDC discovery so database tests are
   deterministic and do not call an external placeholder domain. To test real
   Clerk tokens against local Supabase, enable `[auth.third_party.clerk]` only in
   an uncommitted local config and replace the placeholder with the exact Clerk
   instance domain. The hosted Clerk connection is configured in the Supabase
   dashboard and is unaffected by this local setting.

   The Phase 2 migration creates the private `resumes` bucket, `resumes`,
   `resume_profiles`, and `resume_processing_jobs` tables, the durable
   `resume_processing` Supabase Queue, ownership policies, and the five-megabyte
   PDF restriction. If the checkout is linked to an
   existing hosted project, reconcile any older remote migration versions before
   running `supabase db push`.

5. Add the Phase 2 and Phase 4 server values from `.env.example`. `OPENAI_API_KEY`
   is only read by trusted workers, and `RESUME_WORKER_SECRET` and
   `MATCHING_WORKER_SECRET` are shared only between their Supabase Edge Function
   and internal processing route. Do not expose any of them through a
   `NEXT_PUBLIC_*` variable. The matching worker uses `text-embedding-3-small`
   by default and stores no OpenAI request content.

6. Deploy the bounded worker after the hosted schema is applied:

   ```bash
   supabase functions deploy process-resumes
   supabase secrets set RESULENS_APP_URL=https://your-app.example RESUME_WORKER_SECRET=replace-me
   ```

   Configure a Supabase Cron invocation for `process-resumes` every few minutes.
   The worker reads at most three messages per invocation from the durable
   `resume_processing` queue, checks deletion state before writing, and leaves
   retryable failures visible in the processing tables.

   Deploy the matching worker separately after the Phase 4 migration:

   ```bash
   supabase functions deploy process-embeddings
   supabase secrets set RESULENS_APP_URL=https://your-app.example MATCHING_WORKER_SECRET=replace-me MATCHING_WORKER_BATCH_SIZE=5
   ```

   Schedule `process-embeddings` every few minutes. It consumes only opaque
   embedding-job identifiers, retries provider failures up to three times, and
   checks the current resume/profile or job fingerprint before writing a vector.

7. Configure permitted job sources. Provider credentials remain server-only. Use a trusted Supabase SQL session or an administrative migration to add rows such as:

   ```sql
   insert into public.job_sources (provider, slug, display_name, provider_config)
   values
     ('greenhouse', 'example-board', 'Example board', '{"boardToken":"example","countryCode":"IN"}'),
     ('lever', 'example-company', 'Example company', '{"site":"example-company","countryCode":"IN"}'),
     ('adzuna', 'india-engineering', 'Adzuna India engineering', '{"countryCode":"in","query":"software engineer","location":"India"}');
   ```

   Add `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, and `JOB_INGESTION_SECRET` to the server/worker environment, then deploy the bounded refresh function:

   ```bash
   supabase functions deploy ingest-jobs
   supabase secrets set RESULENS_APP_URL=https://your-app.example JOB_INGESTION_SECRET=replace-me
   ```

   Schedule `ingest-jobs` every four to six hours. Open [/dashboard/jobs](http://127.0.0.1:3000/dashboard/jobs) after a successful run. The worker only stores normalized fields in the exposed schema; raw provider responses remain in the private schema.

8. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://127.0.0.1:3000](http://127.0.0.1:3000), sign in, and open
   [/dashboard](http://127.0.0.1:3000/dashboard) to see the **Scan a resume** card.
   After a profile is approved and the matching worker has processed its vector,
   open [/dashboard/matches](http://127.0.0.1:3000/dashboard/matches) to start a
   versioned match run and review the ranked feed.
   The public landing page does not show the upload control until authentication
   is complete. Use one hostname consistently: Clerk browser sessions for
   `localhost` and `127.0.0.1` are separate during local development. The
   default development command uses Next's webpack path and accepts both
   `localhost` and `127.0.0.1`, which Clerk's development handshake needs when
   protecting server-rendered routes. For testing from another device on the
   same network, use `npm run dev:lan` and add that machine's origin to the Clerk
   development instance allowed origins.

9. For Phase 5, deploy `maintain-production`, give it the same
   `OPERATIONS_WORKER_SECRET` as the app, and schedule it every five minutes.
   Configure Sentry only with environment-specific values. Complete
   [the launch checklist](docs/operations/launch-checklist.md) before a production deploy;
   environment isolation and incident recovery are documented under
   [docs/operations](docs/operations/environments.md).

## Scripts

| Command                | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Start the webpack-backed Next.js development server |
| `npm run dev:lan`      | Start the server on all interfaces for LAN testing  |
| `npm run lint`         | Run ESLint                                          |
| `npm run typecheck`    | Run TypeScript strict checking                      |
| `npm test`             | Run unit tests with Vitest                          |
| `npm run test:db`      | Run Supabase pgTAP tests against the local database |
| `npm run build`        | Create the production Next.js build                 |
| `npm run test:e2e`     | Run Playwright public/protected route checks        |
| `npm run format:check` | Verify Prettier formatting                          |

## Architecture notes

- Clerk owns users, sessions, OAuth, email authentication, and account UI.
- Supabase Auth is not used as a second login system. Supabase receives the Clerk session token through the `accessToken` callback and authorizes rows with `auth.jwt()->>'sub'`.
- The service-role key is reserved for trusted server/worker operations such as the Clerk deletion webhook, signed upload URL creation, storage cleanup, and the bounded resume worker.
- Resume bytes never pass through the normal Next.js upload request. The browser receives a short-lived Supabase signed upload token after authentication and AI-processing consent, uploads directly to the private bucket, then confirms completion.
- Supabase Queues carries only resume/job identifiers. The `resume_processing_jobs` table is the safe status ledger, while queue messages remain worker-only and are acknowledged only after a terminal processing result.
- The PDF worker validates the signature, MIME type, five-megabyte limit, five-page limit, encryption state, and parser result before extracting text with `unpdf`. Weak extraction is routed to a bounded OpenAI file-input fallback.
- OpenAI Responses Structured Outputs uses Zod validation, `store: false`, versioned prompts, bounded output, and server-only keys. Extracted profiles store evidence excerpts and confidence, not raw resume text.
- Profile edits create a new draft version. Approval creates an approved version and clears any future derived-data version so stale embeddings or matches cannot be reused.
- Job ingestion uses the documented public Adzuna search, Greenhouse Job Board, and Lever Postings endpoints through one bounded adapter contract. Provider HTML is stored as sanitized plain text, provider identity is `(source_id, external_job_id)`, a separate fingerprint groups likely cross-provider duplicates in ranked results, private raw payloads are worker-only, and complete refreshes expire unseen listings. Phase 4 queues private resume/job embeddings, applies hard eligibility constraints before hybrid retrieval, and stores deterministic, versioned ResuLens match scores with optional grounded explanations.
- Phase 5 lets users delete source PDFs immediately after approval or retain them for 30 days. The approved profile remains until its resume or account is deleted. Account deletion blocks new writes before revoking sessions and removing Storage/database/Clerk state through a retryable cleanup ledger.
- Sentry is disabled when no DSN is configured. When enabled it uses PII-safe defaults and a recursive scrubber; provider dashboards and alerts still require explicit staging/production configuration.
