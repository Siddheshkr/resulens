import Link from "next/link";

import { AuthControls } from "@/components/auth-controls";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label="ResuLens home" translate="no">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span>ResuLens</span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          <Link href="/dashboard" className="site-nav-link">
            Dashboard
          </Link>
          <Link href="/dashboard/jobs" className="site-nav-link">
            Jobs
          </Link>
          <Link href="/dashboard/matches" className="site-nav-link">
            Matches
          </Link>
        </nav>
        <div className="site-account">
          <AuthControls />
        </div>
      </div>
    </header>
  );
}
