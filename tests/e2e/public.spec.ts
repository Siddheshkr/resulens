import { expect, test } from "@playwright/test";

test("the public landing page renders", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/ResuLens/);
  await expect(
    page.getByRole("heading", { name: /Your experience already knows where it belongs/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Start with your resume/i })).toHaveAttribute(
    "href",
    "/sign-up",
  );
});

test("the Clerk sign-in form is visible", async ({ page }) => {
  await page.goto("/sign-in");

  const formHeading = page.getByRole("heading", { name: /sign in to resulens/i });
  const setupHeading = page.getByRole("heading", { name: /clerk is not connected yet/i });

  await expect(formHeading.or(setupHeading)).toBeVisible({ timeout: 15_000 });

  if (await formHeading.isVisible()) {
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    await expect(page.locator(".cl-formButtonPrimary")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await expect(page.locator(".cl-card")).toHaveCSS("background-color", "rgb(20, 20, 20)");
  }
});

test("the Clerk sign-up form is visible", async ({ page }) => {
  await page.goto("/sign-up");

  const formHeading = page.getByRole("heading", { name: /sign up|create your account/i });
  const setupHeading = page.getByRole("heading", { name: /clerk is not connected yet/i });

  await expect(formHeading.or(setupHeading)).toBeVisible({ timeout: 15_000 });

  if (await formHeading.isVisible()) {
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
  }
});

test("the health endpoint is public and non-sensitive", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ status: "ok", service: "resulens" });
});

test("the private API returns an authentication error to anonymous callers", async ({
  request,
}) => {
  const response = await request.get("/api/private");

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "Authentication required" });
});

test("resume upload creation requires authentication", async ({ request }) => {
  const response = await request.post("/api/resumes", {
    data: {
      filename: "synthetic-resume.pdf",
      mimeType: "application/pdf",
      byteSize: 1024,
      aiProcessingConsent: true,
    },
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "Authentication required" });
});

test("job feed requires authentication", async ({ request }) => {
  const response = await request.get("/api/jobs");

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "Authentication required" });
});

test("matching APIs require authentication", async ({ request }) => {
  const matches = await request.get("/api/matches");
  expect(matches.status()).toBe(401);
  await expect(matches.json()).resolves.toEqual({ error: "Authentication required" });

  const preferences = await request.get("/api/preferences");
  expect(preferences.status()).toBe(401);
  await expect(preferences.json()).resolves.toEqual({ error: "Authentication required" });
});

test("the dashboard redirects unauthenticated users to sign-in", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/sign-in(?:\?.*)?$/);
  await expect(page.locator("main")).toBeVisible();
});

test("the jobs dashboard redirects unauthenticated users to sign-in", async ({ page }) => {
  await page.goto("/dashboard/jobs");

  await expect(page).toHaveURL(/\/sign-in(?:\?.*)?$/);
});

test("the matching dashboard redirects unauthenticated users to sign-in", async ({ page }) => {
  await page.goto("/dashboard/matches");

  await expect(page).toHaveURL(/\/sign-in(?:\?.*)?$/);
});
