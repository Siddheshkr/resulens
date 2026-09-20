import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";

import { SiteHeader } from "@/components/site-header";
import { clerkAppearance } from "@/lib/clerk-appearance";

import "./globals.css";

export const metadata: Metadata = {
  title: "ResuLens — Read your resume. Find the work.",
  description: "Turn your resume into a focused, explainable job search.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#090909",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  // Next's development overlay treats a transient page-focus session-touch
  // failure as an unhandled error. Keep the default activity touch in
  // production, but avoid that noisy dev-only request while developing
  // against a local Clerk instance/network.
  const touchClerkSession = process.env.NODE_ENV === "production";

  const content = (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content">{children}</main>
    </>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {publishableKey ? (
          <ClerkProvider
            dynamic
            appearance={clerkAppearance}
            publishableKey={publishableKey}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            touchSession={touchClerkSession}
          >
            {content}
          </ClerkProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
