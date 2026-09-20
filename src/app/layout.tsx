import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";

import { AppMotion } from "@/components/app-motion";
import { SiteHeader } from "@/components/site-header";
import { ThemeSync } from "@/components/theme-controls";
import { themeScript } from "@/lib/theme-script";
import { clerkAppearance } from "@/lib/clerk-appearance";

import "./globals.css";
import "./themes.css";

export const metadata: Metadata = {
  title: "ResuLens — Read your resume. Find the work.",
  description: "Turn your resume into a focused, explainable job search.",
  icons: {
    icon: "/brand/resulens-app-icon.png",
    apple: "/brand/resulens-app-icon.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#f8f9fc",
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
      <ThemeSync />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content">
        <AppMotion>{children}</AppMotion>
      </main>
    </>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
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
