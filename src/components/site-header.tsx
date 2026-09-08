import Link from "next/link";

import { AuthControls } from "@/components/auth-controls";

export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-[#070708]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2" aria-label="ResuLens home">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span className="text-lg font-extrabold tracking-[-0.04em] text-[var(--foreground)]">
            ResuLens
          </span>
        </Link>
        <nav className="flex items-center gap-4" aria-label="Primary navigation">
          <Link
            href="/dashboard"
            className="hidden text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--foreground)] sm:block"
          >
            Dashboard
          </Link>
          <AuthControls />
        </nav>
      </div>
    </header>
  );
}
