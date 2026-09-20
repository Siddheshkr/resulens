import { ClerkDegraded, ClerkFailed, ClerkLoaded, ClerkLoading, SignUp } from "@clerk/nextjs";

import {
  AuthLoadingState,
  AuthShell,
  ClerkDegradedMessage,
  ClerkFailureMessage,
  ClerkSetupMessage,
} from "@/components/auth-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <AuthShell
        eyebrow="Create account"
        description="Start with the resume you already have. ResuLens will help you see the next move with less noise."
      >
        <ClerkSetupMessage />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Create account"
      description="Start with the resume you already have. ResuLens will help you see the next move with less noise."
    >
      <ClerkLoading>
        <AuthLoadingState label="Preparing secure sign up" mode="sign-up" />
      </ClerkLoading>
      <ClerkFailed>
        <ClerkFailureMessage mode="sign-up" />
      </ClerkFailed>
      <ClerkLoaded>
        <ClerkDegraded>
          <ClerkDegradedMessage />
        </ClerkDegraded>
        <SignUp
          appearance={clerkAppearance}
          fallbackRedirectUrl="/dashboard"
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
        />
      </ClerkLoaded>
    </AuthShell>
  );
}
