# AGENTS.md

This file defines the working rules for all contributors and coding agents in the ResuLens repository. Read `context.md` and `TODO.md` completely before planning or changing code.

## Mission

Build ResuLens as a secure, explainable resume-to-job matching product. Preserve the product boundaries, architecture decisions, privacy invariants, and delivery order in `context.md`.

## Before Making Changes

1. Read `context.md`, `TODO.md`, and any nearer `AGENTS.md` in the area being changed.
2. Inspect the current repository, Git status, relevant code, tests, migrations, and generated types.
3. Confirm the requested work belongs to the current MVP or explicitly identify it as a scope change.
4. Check current official documentation before adding or upgrading an external service or dependency.
5. Prefer the smallest coherent change that completes the requested behavior.

Do not modify unrelated dirty files. Do not discard, overwrite, or reformat user-owned work outside the task.

Use `TODO.md` for repository-level work status. When beginning an existing task, keep it in the appropriate active section; when completing it, move it to Completed with the date and verification evidence. Do not mark work complete based only on implementation if required checks have not passed.

## Source of Truth

Priority order:

1. The user's current request
2. This `AGENTS.md`
3. `context.md`
4. Current official provider/framework documentation
5. Existing implementation and tests

If implementation and documentation disagree, investigate and state the conflict. Do not silently choose one.

## Architecture Rules

- Use TypeScript in strict mode. Avoid `any`; validate unknown external data before use.
- Default to Server Components. Add Client Components only where browser state or interaction requires them.
- Keep Route Handlers and Server Actions thin. They authenticate, validate, call a service, and translate the result.
- Put business rules in feature/domain services and database access in repositories.
- Keep job providers behind a common adapter contract. Provider-specific response types must not leak into product UI or matching code.
- Validate API, provider, database-boundary, form, and AI data with Zod.
- Use generated Supabase database types. Do not maintain competing handwritten row types.
- Use SQL migrations for every database change. Never make an undocumented production-only schema edit.
- Run expensive or failure-prone work asynchronously. PDF parsing, AI calls, job ingestion, and embeddings require explicit status, retry, timeout, and failure behavior.
- Use stable package releases and commit the lockfile. Do not add canary, beta, or experimental technology without documenting the reason and rollback path.
- Avoid speculative abstractions and unused infrastructure.

## AI Rules

- Use the official OpenAI SDK and Responses API.
- Use JSON Schema Structured Outputs validated again with Zod.
- Set `store: false` for requests containing resume or candidate information.
- Never expose an OpenAI key to the browser.
- Never let the model invent missing resume facts or job requirements.
- Require source evidence and confidence for extracted claims.
- The LLM may extract, normalize, classify, and explain. It does not scrape jobs or calculate the authoritative numeric match score.
- Keep prompts versioned in source, small, testable, and free of secrets.
- Record model name, prompt version, schema version, latency, token usage, and outcome without recording resume content.
- Add or update synthetic evaluation fixtures whenever extraction or explanation behavior changes.
- Pin a model snapshot after evaluations establish a production baseline; do not change production models without rerunning the eval set.

## PDF and Upload Rules

- Treat every uploaded PDF as untrusted input.
- Validate file signature and MIME type; extension alone is insufficient.
- Enforce byte, page, duration, and memory limits before processing.
- Reject encrypted/password-protected PDFs in the MVP with a clear user message.
- Disable executable PDF features and use bounded parsing options.
- Do not parse large files synchronously in the upload request.
- Store files privately and use short-lived signed URLs.
- Prefer local text extraction. Use model vision/file input only when extraction quality is insufficient.
- Never add real resumes to source control, logs, snapshots, or analytics.
- Every failure path must release resources and move the processing record to a terminal or retryable state.

## Job Data Rules

- Use documented APIs, feeds, and public ATS endpoints. Do not add LinkedIn or Indeed scraping.
- Respect provider terms, attribution, rate limits, pagination, and retention requirements.
- Sanitize provider HTML before rendering it.
- Preserve canonical source URLs and source timestamps.
- Deduplicate with provider identity plus a content/canonical-URL strategy.
- Keep raw provider payloads private; expose normalized fields through application queries or views.
- Make ingestion idempotent. Retrying a run must not create duplicate jobs.
- A single provider failure must not prevent other adapters from completing.
- Use timeouts, bounded concurrency, exponential backoff, and observable failure records.

## Matching Rules

- Apply hard eligibility constraints before semantic similarity.
- Keep scoring deterministic, versioned, and independently testable.
- Never describe a match score as an ATS score, hiring probability, or employer decision.
- Do not penalize users for fields missing from provider data; renormalize applicable weights.
- Explanations must be derived from stored scoring evidence.
- Any scoring-weight or normalization change requires evaluation against the representative fixture set.
- Measure ranking quality with user labels and retrieval metrics such as precision at 10 and nDCG, not anecdotes alone.

## Database and Supabase Rules

- Enable RLS on every table in an exposed schema.
- Define explicit grants and separate policies for select, insert, update, and delete.
- Use `(select auth.uid())` patterns where appropriate and index every ownership/filter column used by RLS.
- Keep service-role access in trusted server or worker code only.
- Put internal functions and raw ingestion data in non-exposed schemas when practical.
- Set `search_path` deliberately in security-definer functions, revoke public execution, and grant only the required roles.
- Add pgTAP tests for all RLS and security-definer behavior.
- Use database constraints for invariants that must hold regardless of the caller.
- Make migrations forward-only and safe on existing data. Include a rollback or recovery note for risky operations.
- Benchmark vector indexes with representative data before tuning HNSW parameters.
- Generate and review TypeScript database types after migrations.

## Security and Privacy Rules

- Authentication is required before resume bytes are uploaded.
- User-owned private data must always include an enforceable ownership relationship.
- Never expose service-role, OpenAI, Adzuna, or infrastructure secrets through `NEXT_PUBLIC_*`, client bundles, logs, or error responses.
- Do not log names, emails, phone numbers, addresses, resume text, signed URLs, prompts containing PII, or raw provider credentials.
- Use safe, user-facing error messages and separate internal error identifiers.
- Apply rate limits to uploads, scans, matching, authentication-sensitive flows, and feedback endpoints.
- Validate redirect and canonical URLs before exposing them.
- Provide complete deletion of raw and derived candidate data.
- Use synthetic data in development, tests, fixtures, screenshots, and demos.
- Treat a framework or dependency security advisory affecting a reachable ResuLens path as release-blocking.

## UI and Accessibility Rules

- Build mobile-first and test critical workflows at mobile and desktop widths.
- Use semantic HTML and accessible shadcn/Radix primitives.
- All interactions must work by keyboard and expose visible focus states.
- Form controls require labels, useful validation messages, and focus management after errors.
- Processing states require text status, not animation alone.
- Do not rely on color alone to communicate match quality, missing requirements, or errors.
- Respect reduced-motion settings.
- Preserve useful behavior when JavaScript or a provider request fails where practical.
- Keep job explanations concise and separate facts, inferred fit, gaps, and unknowns.

## Testing and Verification

For every change, run the narrowest relevant checks first, then broader checks in proportion to risk.

Expected project-level gates once scaffolding exists:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:db
npm run build
npm run test:e2e
```

Do not claim a check passed unless it ran successfully in the current checkout. If a check cannot run, report the exact blocker and distinguish it from a failure.

Testing expectations:

- Unit-test parsing quality checks, score calculation, normalization, deduplication, and provider mapping.
- Contract-test each external provider with sanitized fixtures.
- Integration-test repositories, queues, migrations, storage policies, and RLS.
- End-to-end test authentication, upload, processing, review, matches, save/dismiss/apply, deletion, and failure recovery.
- Add regression tests before or with every bug fix.
- Use deterministic synthetic fixtures; do not make the normal test suite depend on live paid APIs.

## Documentation and Change Discipline

- Update `context.md` when an accepted product boundary, workflow, provider, model, scoring rule, stack baseline, or security invariant changes.
- Update `TODO.md` when planned work, dependencies, blockers, or verified completion status changes.
- Add an architecture decision record for material decisions with long-lived tradeoffs.
- Keep `.env.example` limited to variable names and safe descriptions; never include usable secrets.
- Document new scripts in the README and keep setup reproducible from a clean checkout.
- Avoid drive-by dependency upgrades or whole-repository formatting in feature changes.
- Keep commits cohesive and explain migrations, privacy impact, and verification in the handoff.

## Definition of Complete

A task is complete only when:

- The requested behavior is implemented within agreed scope.
- Types, validation, error states, authorization, and privacy implications are handled.
- Relevant automated tests exist and pass.
- Database changes include migrations, generated types, and RLS tests where applicable.
- User-visible behavior is checked on appropriate screen sizes and input methods.
- Documentation reflects material architecture or workflow changes.
- The final handoff lists changes, verification evidence, known limitations, and any safe next step.
