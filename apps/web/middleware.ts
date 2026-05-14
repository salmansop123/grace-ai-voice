import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { isValidClerkKey } from "@/lib/clerk-config";

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

/** Marketing pages skip Clerk middleware to avoid SSO/session redirect churn (ERR_TOO_MANY_REDIRECTS). */
function isPublicMarketingRoute(pathname: string): boolean {
  const trimmed = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (trimmed === "/" || trimmed.toLowerCase() === "/home") {
    return true;
  }
  return pathname.startsWith("/contact");
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isPublicMarketingRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!isValidClerkKey(CLERK_KEY)) {
    const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
    const hasDevSession = request.cookies.get("grace_dev_auth")?.value === "1";

    if (isDashboardRoute && !hasDevSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Do not redirect signed-in users away from /sign-in here. Dashboard layout verifies
    // the session via POST /api/auth/dev/verify and redirects to /sign-in on failure.
    // Forcing dashboard from auth routes would infinite-loop with that check (blank page).

    return NextResponse.next();
  }

  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");
  const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);
  const handler = clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) {
      await auth().protect();
    }
  });
  return handler(request, event);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
