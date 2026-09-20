import { ClerkDegraded, ClerkFailed, ClerkLoaded, ClerkLoading, SignIn } from "@clerk/nextjs";

import {
  AuthLoadingState,
  AuthShell,
  ClerkDegradedMessage,
  ClerkFailureMessage,
  ClerkSetupMessage,
} from "@/components/auth-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <AuthShell
        eyebrow="Sign in"
        description="Your profile stays private while ResuLens turns your experience into a focused search."
      >
        <ClerkSetupMessage />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      description="Your profile stays private while ResuLens turns your experience into a focused search."
    >
      <ClerkLoading>
        <AuthLoadingState label="Preparing secure sign in" mode="sign-in" />
      </ClerkLoading>
      <ClerkFailed>
        <ClerkFailureMessage mode="sign-in" />
      </ClerkFailed>
      <ClerkLoaded>
        <ClerkDegraded>
          <ClerkDegradedMessage />
        </ClerkDegraded>
        <SignIn
          appearance={clerkAppearance}
          fallbackRedirectUrl="/dashboard"
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
        />
      </ClerkLoaded>
    </AuthShell>
  );
}
