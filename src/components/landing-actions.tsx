"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

type LandingActionMode = "hero" | "privacy";

export function LandingActions({ mode }: Readonly<{ mode: LandingActionMode }>) {
  // Clerk can briefly report a pending session as signed out while it restores
  // the browser session after a full refresh. Keep signed-out CTAs hidden until
  // that pending state is resolved so an authenticated user never sees a
  // misleading sign-in/sign-up flash.
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });

  if (!isLoaded || isSignedIn === undefined) {
    return (
      <span className="text-sm text-[var(--muted)]" role="status" aria-live="polite">
        Checking workspace…
      </span>
    );
  }

  if (isSignedIn) {
    return (
      <Link href="/dashboard" className="button-primary">
        Open Your Workspace
      </Link>
    );
  }

  if (mode === "privacy") {
    return (
      <Link href="/sign-up" className="button-primary">
        Start With Your Resume
      </Link>
    );
  }

  return (
    <>
      <Link href="/sign-up" className="button-primary">
        Start With Your Resume
      </Link>
      <Link href="#workflow-title" className="button-secondary">
        See how it works
      </Link>
    </>
  );
}
