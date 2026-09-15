# Launch checklist

Production deployment is allowed only after every blocking item has current evidence.

## Automated gates

- [x] `npm run format:check` — 2026-09-15, Node 24.20.0
- [x] `npm run lint` — 2026-09-15, Node 24.20.0
- [x] `npm run typecheck` — 2026-09-15, Node 24.20.0
- [x] `npm test` — 47 tests passed on 2026-09-15
- [ ] `npm run test:db`
- [x] `npm run build` — 2026-09-15, Node 24.20.0
- [x] `npm run test:e2e` — 26 desktop/mobile tests passed on 2026-09-15
- [x] Production dependency audit has no reachable high/critical advisory — `npm audit --omit=dev --audit-level=high` reported 0 vulnerabilities on 2026-09-15

`npm run test:db` remains unchecked locally because the developer environment has
no local Postgres/Docker service (`ECONNREFUSED 127.0.0.1:54322`). Hosted pgTAP
suites are the current Docker-free database evidence; rerun the local command in
CI or a developer environment with Supabase local services enabled.

## Staging integration gates

- [ ] Clerk email and Google sign-in, sign-out, session revocation, and `user.deleted` webhook work
- [ ] Text and scanned synthetic PDFs reach review, correction, approval, and selected raw-file expiry
- [ ] Resume and embedding workers recover a deliberately stalled task
- [ ] Adzuna and permitted Greenhouse/Lever sources ingest without duplicates or leaked raw payloads
- [ ] Matching completes, explanations cite stored evidence, and save/apply state remains user-controlled
- [ ] Account deletion removes Storage objects and all applicant/derived rows; a forced partial failure retries
- [ ] Sentry receives a synthetic scrubbed exception and every launch alert is enabled
- [ ] Representative p50/p95 scan and matching latency and AI cost are recorded
- [ ] Backup/PITR availability and the rollback procedure are verified

## Release record

Record the Git commit, migration versions, Vercel deployment, Edge Function versions, test output, smoke-test date, latency measurements, alert links, reviewer, rollback target, and non-blocking follow-up work. Never put credentials or applicant content in the record.
