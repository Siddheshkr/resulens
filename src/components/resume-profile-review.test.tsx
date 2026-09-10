import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ResumeProfileReview } from "@/components/resume-profile-review";
import { emptyResumeProfile } from "@/lib/resumes/profile-schema";

describe("ResumeProfileReview", () => {
  it("lets an approved profile enter correction mode", async () => {
    const user = userEvent.setup();
    render(
      <ResumeProfileReview
        resumeId="00000000-0000-0000-0000-000000000001"
        profile={emptyResumeProfile}
        approved
        onUpdated={vi.fn()}
      />,
    );

    const profile = screen.getByLabelText("Structured profile");
    expect(profile).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /edit approved profile/i }));

    expect(profile).toBeEnabled();
    expect(screen.getByRole("button", { name: /save.*approve new version/i })).toBeVisible();
  });
});
