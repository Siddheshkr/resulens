"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/account-menu";

export function AuthControls() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <span className="setup-badge">Clerk setup required</span>;
  }

  return <ConfiguredAuthControls />;
}

function ConfiguredAuthControls() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });

  if (!isLoaded || isSignedIn === undefined) {
    return (
      <span className="sr-only" role="status" aria-live="polite">
        Checking session…
      </span>
    );
  }

  const isSignIn = pathname?.startsWith("/sign-in");
  const isSignUp = pathname?.startsWith("/sign-up");

  return (
    <div className="flex items-center gap-3">
      {!isSignedIn && (
        <>
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
        </>
      )}
      {isSignedIn && <AccountMenu />}
    </div>
  );
}
