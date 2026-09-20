import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AccountMenu } from "@/components/account-menu";

vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({ openUserProfile: vi.fn(), signOut: vi.fn() }),
  useUser: () => ({ isLoaded: true, user: { fullName: "Demo Candidate" } }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
});

it("keeps appearance next to account actions and supports keyboard selection", async () => {
  const user = userEvent.setup();
  render(<AccountMenu />);
  await user.click(screen.getByRole("button", { name: "Open account menu" }));
  expect(screen.getByRole("menuitem", { name: /Settings/ })).toBeVisible();
  expect(screen.getByRole("menuitem", { name: /Sign out/ })).toBeVisible();
  const light = screen.getByRole("menuitemradio", { name: "Light" });
  await user.click(light);
  expect(light).toHaveAttribute("aria-checked", "true");
  expect(localStorage.getItem("resulens-theme")).toBe("light");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(document.documentElement.dataset.theme).toBe("dark");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open account menu" })).toHaveFocus();
});
