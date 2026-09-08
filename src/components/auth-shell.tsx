import Link from "next/link";

export {
  AuthLoadingState,
  ClerkDegradedMessage,
  ClerkFailureMessage,
} from "@/components/auth-state";

type AuthShellProps = Readonly<{
  children: React.ReactNode;
  eyebrow: string;
  description: string;
}>;

export function AuthShell({ children, eyebrow, description }: AuthShellProps) {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-story" aria-label="ResuLens authentication">
          <Link href="/" className="auth-story-mark" aria-label="Back to ResuLens home">
            <span className="brand-mark" aria-hidden="true">
              R
            </span>
            <span>ResuLens</span>
          </Link>

          <div className="auth-story-copy">
            <p className="eyebrow">{eyebrow}</p>
            <p className="auth-story-title">A clearer read on your next move.</p>
            <p className="auth-story-description">{description}</p>
          </div>

          <div className="auth-story-scan" aria-hidden="true">
            <div className="scan-sheet">
              <span className="scan-sheet-heading" />
              <span className="scan-sheet-line scan-sheet-line-wide" />
              <span className="scan-sheet-line" />
              <span className="scan-sheet-line scan-sheet-line-short" />
              <span className="scan-sheet-rule" />
              <span className="scan-sheet-line scan-sheet-line-wide" />
              <span className="scan-sheet-line" />
              <span className="scan-sheet-line scan-sheet-line-short" />
              <span className="scan-beam" />
            </div>
            <div className="scan-caption">
              <span className="scan-caption-dot" />
              <span>Profile signal ready</span>
            </div>
          </div>
        </section>

        <section className="auth-panel resulens-auth-panel" aria-label={`${eyebrow} form`}>
          <div className="auth-panel-inner">{children}</div>
        </section>
      </div>
    </div>
  );
}

export function ClerkSetupMessage() {
  return (
    <div className="auth-setup-message">
      <span className="eyebrow">Local setup</span>
      <h1>Clerk is not connected yet.</h1>
      <p>
        Add the Clerk variables from <code>.env.example</code> to enable authentication locally.
      </p>
    </div>
  );
}
