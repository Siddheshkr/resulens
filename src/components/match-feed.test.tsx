import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MatchFeed } from "@/components/match-feed";

const preferences = {
  revision: 1,
  countryCodes: [],
  preferredLocations: [],
  workplaceTypes: [],
  roleExclusions: [],
  minimumExperienceYears: null,
  maximumExperienceYears: null,
  salaryMinimum: null,
  salaryCurrency: null,
  workAuthorizationStatus: "unknown" as const,
};

describe("MatchFeed guidance", () => {
  afterEach(cleanup);
  it("explains the approval requirement and prevents matching a draft", () => {
    render(
      <MatchFeed
        resumes={[
          {
            id: "draft",
            original_filename: "sample.pdf",
            status: "processing",
            approved_profile_version: null,
          },
        ]}
        initialPreferences={preferences}
        initialRun={null}
      />,
    );
    expect(screen.getByText("Start with an approved resume")).toBeVisible();
    expect(screen.getByRole("button", { name: "Find My Matches" })).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: "Approved resume" })).not.toBeInTheDocument();
  });

  it("shows the matching controls and next step for an approved resume", () => {
    render(
      <MatchFeed
        resumes={[
          {
            id: "approved",
            original_filename: "sample.pdf",
            status: "approved",
            approved_profile_version: 1,
          },
        ]}
        initialPreferences={preferences}
        initialRun={null}
      />,
    );
    expect(screen.getByText("Ready to find your next role?")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Approved resume" })).toHaveValue("approved");
    expect(screen.getByRole("button", { name: "Find My Matches" })).toBeEnabled();
  });
});
