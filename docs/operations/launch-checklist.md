# Launch checklist

Production deployment is allowed only after every blocking item has current evidence.

## Automated gates

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run test:db`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] Production dependency audit has no reachable high/critical advisory

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
