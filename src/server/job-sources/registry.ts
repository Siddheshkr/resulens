import { adzunaAdapter } from "@/server/job-sources/adzuna";
import { greenhouseAdapter } from "@/server/job-sources/greenhouse";
import { leverAdapter } from "@/server/job-sources/lever";
import { JobSourceError } from "@/server/job-sources/types";
import type { JobProvider, JobSourceAdapter } from "@/server/job-sources/types";

const adapters: Record<JobProvider, JobSourceAdapter> = {
  adzuna: adzunaAdapter,
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
};

export function getJobSourceAdapter(provider: JobProvider) {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new JobSourceError("unsupported_provider", "This job provider is not supported.");
  }
  return adapter;
}
