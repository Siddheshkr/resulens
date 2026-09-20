"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AuthControls() {
  const pathname = usePathname();

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <span className="setup-badge">Clerk setup required</span>;
  }

  const isSignIn = pathname?.startsWith("/sign-in");
  const isSignUp = pathname?.startsWith("/sign-up");

  return (
    <div className="flex items-center gap-3">
      <Show when="signed-out">
        {!isSignIn && (
          <Link href="/sign-in" className="header-link">
            Sign in
          </Link>
        )}
        {!isSignUp && (
          <Link href="/sign-up" className="header-cta">
            Get started
          </Link>
        )}
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
