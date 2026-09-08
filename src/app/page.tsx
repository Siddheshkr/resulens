import Link from "next/link";

const benefits = [
  ["Reviewable profile", "Correct extracted details before they influence your matches."],
  ["Relevant discovery", "Search approved sources with location and seniority in view."],
  ["Grounded reasons", "See the evidence behind a match and the gaps worth checking."],
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
      <section className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <div className="mb-7 flex items-center gap-3">
            <span className="brand-mark" aria-hidden="true">
              R
            </span>
            <p className="eyebrow">Resume intelligence for your next move</p>
          </div>
          <h1 className="max-w-3xl text-pretty text-5xl font-extrabold tracking-[-0.065em] text-[var(--foreground)] sm:text-7xl">
            Your experience already knows where it belongs.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">
            Upload once, review the read, and see roles with a reason behind every recommendation.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/sign-up" className="header-cta min-h-12 px-5 text-sm">
              Start with your resume
            </Link>
            <Link
              href="/sign-in"
              className="header-link min-h-12 border border-[var(--border)] px-5"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-5 text-xs text-[var(--quiet)]">
            Private by default. You approve the profile before matching starts.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl shadow-black/30 sm:p-7">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-[var(--signal)]/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Profile read</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  A structured view of your experience
                </p>
              </div>
              <span className="rounded-full border border-[#ff715b]/30 bg-[#ff715b]/10 px-3 py-1 text-xs font-bold text-[#ff9a89]">
                Ready
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_0.75fr]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-[#8c83ff]/15 text-sm font-bold text-[#b8b2ff]">
                    SK
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Software engineer
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Product-minded · 5 years</p>
                  </div>
                </div>
                <div className="mt-7 space-y-3" aria-label="Extracted profile signals">
                  <span className="profile-line profile-line-wide" />
                  <span className="profile-line" />
                  <span className="profile-line profile-line-short" />
                  <span className="profile-rule" />
                  <span className="profile-chip">TypeScript</span>
                  <span className="profile-chip profile-chip-violet">Product delivery</span>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-[#ff715b]/20 bg-[#ff715b]/[0.07] p-5">
                <div>
                  <p className="text-xs font-semibold text-[#ffad9f]">Example match</p>
                  <p className="mt-3 text-4xl font-extrabold tracking-[-0.06em] text-[var(--foreground)]">
                    87%
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Product-focused software engineer
                  </p>
                </div>
                <div className="mt-7 border-t border-[#ff715b]/20 pt-4">
                  <p className="text-xs font-semibold text-[var(--foreground)]">Why it fits</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Delivery, TypeScript, and collaboration show up in the evidence.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-[var(--muted)]">
              <span className="scan-caption-dot" aria-hidden="true" />
              <span>Matches stay explainable, even when the answer is “not yet.”</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-24 border-t border-white/10 pt-8" aria-label="ResuLens benefits">
        <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
          {benefits.map(([title, description]) => (
            <article key={title} className="border-t border-white/10 pt-4">
              <h2 className="text-base font-bold text-[var(--foreground)]">{title}</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--muted)]">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
