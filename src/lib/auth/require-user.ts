import { auth } from "@clerk/nextjs/server";

import { isClerkConfigured } from "@/lib/config";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "AuthenticationRequiredError";
  }
}

export async function requireUser(): Promise<{ userId: string }> {
  if (!isClerkConfigured()) {
    throw new AuthenticationRequiredError();
  }

  const { userId } = await auth();

  if (!userId) {
    throw new AuthenticationRequiredError();
  }

  return { userId };
}
