import * as Sentry from "@sentry/nextjs";

import { scrubSentryEvent } from "@/lib/observability/scrub";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? "development",
  release: process.env.SENTRY_RELEASE,
  sendDefaultPii: false,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: scrubSentryEvent,
});
