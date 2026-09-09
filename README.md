# ResuLens

ResuLens is a resume-first job discovery application. Phase 1 provides the Next.js foundation, Clerk authentication, the Clerk-to-Supabase session-token bridge, and the first profile ownership boundary.

## Requirements

- Node.js 24 LTS (`.nvmrc`)
- npm 11 (recorded in `package.json`)
- A Clerk development instance
- A Supabase project configured with Clerk as its third-party authentication provider
- Docker Desktop or Podman for local Supabase pgTAP tests

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

   The local config keeps the Clerk domain as an environment-specific placeholder so real provider domains are not committed.

5. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The default development
   command uses Next's webpack path for stable Clerk middleware behavior and
   binds to IPv4 loopback so local browsers and the in-app browser can reach it
   consistently. For testing from another device on the same network,
   use `npm run dev:lan` and add that machine's origin to the Clerk development
   instance allowed origins.

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
- The service-role key is reserved for trusted server/worker operations such as the Clerk deletion webhook.
- Resume processing, job ingestion, embeddings, and matching are intentionally deferred to later phases.
