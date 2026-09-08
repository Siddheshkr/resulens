"use client";

import { useEffect, useState } from "react";

type AuthMode = "sign-in" | "sign-up";

const AUTH_LOADING_TIMEOUT_MS = 8_000;

export function AuthLoadingState({ label, mode }: Readonly<{ label: string; mode: AuthMode }>) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setTimedOut(true), AUTH_LOADING_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  if (timedOut) {
    return <AuthFailureMessage mode={mode} timedOut />;
  }

  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <span className="auth-loading-orbit" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function ClerkFailureMessage({ mode }: Readonly<{ mode: AuthMode }>) {
  return <AuthFailureMessage mode={mode} />;
}

export function ClerkDegradedMessage() {
  return (
    <p className="auth-degraded-message" role="status">
      Authentication is responding slowly. Your form is still available.
    </p>
  );
}

function AuthFailureMessage({
  mode,
  timedOut = false,
}: Readonly<{ mode: AuthMode; timedOut?: boolean }>) {
  const action = mode === "sign-in" ? "sign in" : "create your account";

  return (
    <div className="auth-setup-message" role="alert">
      <span className="eyebrow">Authentication unavailable</span>
      <h1>We couldn’t load secure {action}.</h1>
      <p>
        {timedOut
          ? "The authentication service did not respond. Check your connection or open ResuLens at http://127.0.0.1:3000, then try again."
          : "Check your connection and try again. If this keeps happening, confirm that this app origin is allowed in the Clerk development instance."}
      </p>
      <button className="auth-retry-button" type="button" onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );
}
