"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthControls } from "@/components/auth-controls";
import { ResuLensLogo } from "@/components/resulens-logo";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", exact: true },
  { href: "/dashboard/jobs", label: "Jobs", exact: false },
  { href: "/dashboard/matches", label: "Matches", exact: false },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label="ResuLens home" translate="no">
          <ResuLensLogo priority />
          <span>ResuLens</span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          {NAV_LINKS.map((link) => {
            const isActive = link.exact ? pathname === link.href : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`site-nav-link ${isActive ? "site-nav-link-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="site-account">
          <AuthControls />
        </div>
      </div>
    </header>
  );
}
