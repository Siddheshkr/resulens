import { expect, test } from "@playwright/test";

test("the public landing page renders", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/ResuLens/);
  await expect(
    page.getByRole("heading", { name: /Your experience already knows where it belongs/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start with your resume" })).toHaveAttribute(
    "href",
    "/sign-up",
  );
});

test("the Clerk sign-in form is visible", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.getByRole("heading", { name: /sign in to resulens/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await expect(page.locator(".cl-formButtonPrimary")).toHaveCSS(
    "background-color",
    "rgb(255, 113, 91)",
  );
  await expect(page.locator(".cl-card")).toHaveCSS("background-color", "rgba(17, 18, 22, 0.96)");
});

test("the Clerk sign-up form is visible", async ({ page }) => {
  await page.goto("/sign-up");

  await expect(page.getByRole("heading", { name: /sign up|create your account/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
});

test("the health endpoint is public and non-sensitive", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ status: "ok", service: "resulens" });
});

test("the dashboard redirects unauthenticated users to sign-in", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/sign-in(?:\?.*)?$/);
  await expect(page.locator("main")).toBeVisible();
});
