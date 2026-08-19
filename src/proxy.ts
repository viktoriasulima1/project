import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isClerkConfigured } from '@/lib/clerk-config';
import { PUBLIC_ROUTES } from '@/lib/public-routes';

const clerkEnabled = isClerkConfigured(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clerkMiddleware, createRouteMatcher } = clerkEnabled
  ? require('@clerk/nextjs/server')
  : { clerkMiddleware: null, createRouteMatcher: null };

// /api/health is deliberately public — Sprint 12 finding: load balancers
// and uptime monitors hit it with no browser session at all, and Clerk's
// auth.protect() was redirecting those checks to /sign-in instead of ever
// reaching the route handler.
// Public routes (incl. /dev/mobile-diagnostics, which 404s in production) come
// from the shared PUBLIC_ROUTES list so middleware and tests never drift.
const isPublicRoute = clerkEnabled ? createRouteMatcher([...PUBLIC_ROUTES]) : null;

const clerkProxy = clerkEnabled
  ? clerkMiddleware(async (auth: { protect: () => Promise<void> }, request: NextRequest) => {
      if (isPublicRoute && !isPublicRoute(request)) {
        await auth.protect();
      }
    })
  : null;

export function proxy(request: NextRequest) {
  if (clerkProxy) return clerkProxy(request);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
