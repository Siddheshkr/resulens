# Environment separation

ResuLens uses three isolated environments. Never reuse Clerk instances, Supabase projects, OpenAI keys, worker secrets, Storage buckets, Sentry environments, or provider credentials between them.

| Environment | Purpose                                     | Data rule                                                   | Deployment                                                                 |
| ----------- | ------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Development | Local implementation and synthetic testing  | Synthetic data only                                         | Local Next.js and a development Supabase project                           |
| Staging     | Provider smoke tests and release candidates | Synthetic applicants and permitted job-source fixtures only | A protected Vercel preview/staging project and separate provider resources |
| Production  | Public MVP                                  | Real user data under the retention policy                   | Vercel production and dedicated production services                        |

Use `.env.example` as the variable inventory, then store actual values in the provider/Vercel environment. Environment-variable changes require a new deployment. Do not commit `.env.local`, downloaded credentials, signed URLs, or test-user sessions.

For each environment:

1. Configure a distinct Clerk instance and its native Supabase integration.
2. Configure a distinct Supabase project, apply migrations in order, and enable the exact Clerk domain.
3. Create least-scope OpenAI and job-provider keys with environment-specific budgets.
4. Configure `RESULENS_APP_URL` and distinct resume, matching, ingestion, and operations worker secrets.
5. Configure Sentry with the matching environment name and source-map build credentials.
6. Deploy and schedule `process-resumes`, `process-embeddings`, `ingest-jobs`, and `maintain-production`.

The database backup does not include Storage objects. Database recovery and Storage retention are separate concerns; raw PDFs are intentionally short-lived and must not be copied into an ungoverned backup system.
