import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isClerkConfigured } from "@/lib/config";

function isProtectedPageRoute(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function isProtectedApiRoute(pathname: string) {
  return pathname === "/api/private" || pathname.startsWith("/api/private/");
}

function isProtectedRoute(pathname: string) {
  return isProtectedPageRoute(pathname) || isProtectedApiRoute(pathname);
}

function hasClerkCredential(request: Request) {
  if (request.headers.get("authorization")) {
    return true;
  }

  return request.headers
    .get("cookie")
    ?.split(";")
    .some((cookie) => {
      const name = cookie.trim().split("=", 1)[0];
      return (
        name === "__client_uat" ||
        name.startsWith("__client_uat_") ||
        name === "__clerk_db_jwt" ||
        name.startsWith("__clerk_db_jwt_") ||
        name === "__session" ||
        name.startsWith("__session_")
      );
    });
}

function continueAsSignedOutApiRequest(request: Request) {
  const headers = new Headers(request.headers);
  headers.set("x-clerk-auth-status", "signed-out");

  return NextResponse.next({ request: { headers } });
}

const configuredProxy = clerkMiddleware(async (auth, request) => {
  if (isProtectedPageRoute(request.nextUrl.pathname)) {
    await auth.protect({ unauthenticatedUrl: new URL("/sign-in", request.url).toString() });
  }
});

export default function proxy(...args: Parameters<typeof configuredProxy>) {
  const [request] = args;

  if (!isClerkConfigured() || !isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (isProtectedApiRoute(request.nextUrl.pathname) && !hasClerkCredential(request)) {
    return continueAsSignedOutApiRequest(request);
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
