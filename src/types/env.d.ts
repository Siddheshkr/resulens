declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
    CLERK_SECRET_KEY?: string;
    CLERK_WEBHOOK_SIGNING_SECRET?: string;
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    JOB_INGESTION_SECRET?: string;
    JOB_INGESTION_MAX_PAGES?: string;
    JOB_INGESTION_MAX_SOURCES?: string;
    ADZUNA_APP_ID?: string;
    ADZUNA_APP_KEY?: string;
    ADZUNA_COUNTRY_CODE?: string;
    ADZUNA_DEFAULT_QUERY?: string;
  }
}
