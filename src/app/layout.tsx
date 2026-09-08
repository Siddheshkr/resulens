import { ClerkProvider } from "@clerk/nextjs";
import { ui } from "@clerk/ui";
import type { Metadata, Viewport } from "next";

import { SiteHeader } from "@/components/site-header";
import { clerkAppearance } from "@/lib/clerk-appearance";

import "./globals.css";

export const metadata: Metadata = {
  title: "ResuLens — Find the right opportunities",
  description: "Turn your resume into a focused, explainable job search.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#070708",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

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
    <html lang="en">
      <body>
        {publishableKey ? (
          <ClerkProvider
            dynamic
            appearance={clerkAppearance}
            publishableKey={publishableKey}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            ui={ui}
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
