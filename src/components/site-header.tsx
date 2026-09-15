import Link from "next/link";

import { AuthControls } from "@/components/auth-controls";
import { ResuLensLogo } from "@/components/resulens-logo";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label="ResuLens home" translate="no">
          <ResuLensLogo priority />
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
          <Link href="/dashboard/settings" className="site-nav-link">
            Settings
          </Link>
        </nav>
        <div className="site-account">
          <AuthControls />
        </div>
      </div>
    </header>
  );
}
