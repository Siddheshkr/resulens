import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isClerkConfigured } from "@/lib/config";

const configuredProxy = clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/api/private" ||
    pathname.startsWith("/api/private/");

  if (isProtectedRoute) {
    await auth.protect({ unauthenticatedUrl: new URL("/sign-in", request.url).toString() });
  }
});

export default function proxy(...args: Parameters<typeof configuredProxy>) {
  if (!isClerkConfigured()) {
    return NextResponse.next();
  }

  return configuredProxy(...args);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
