"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export function AuthControls() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
        Clerk setup required
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Show when="signed-out">
        <Link href="/sign-in" className="header-link">
          Sign in
        </Link>
        <Link href="/sign-up" className="header-cta">
          Get started
        </Link>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
