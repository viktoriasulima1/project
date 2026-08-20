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
  ? clerkMiddleware(async (auth: { protect: (opts?: { unauthenticatedUrl?: string }) => Promise<void> }, request: NextRequest) => {
      if (isPublicRoute && !isPublicRoute(request)) {
        // Without this, protect() falls back to Clerk's hosted Account
        // Portal (accounts.<this-domain>/sign-in) — a subdomain Clerk
        // expects to provision via DNS we don't control on a shared
        // *.vercel.app domain, so it 404s/SSL-errors instead of ever
        // loading. This app has its own real /sign-in page; send
        // unauthenticated visitors there instead.
        await auth.protect({ unauthenticatedUrl: new URL('/sign-in', request.url).toString() });
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
    // Clerk's auto-proxy for *.vercel.app domains (see proxy.ts's clerkProxy
    // above — clerkMiddleware() forwards these to Clerk's backend itself,
    // before our handler runs) serves clerk-js as a proxied .js file, e.g.
    // /__clerk/npm/@clerk/clerk-js@6/dist/clerk.browser.js — the general
    // matcher above explicitly excludes .js paths (to skip our own static
    // chunks), which silently 404'd every one of these and left the sign-in
    // widget with no script to render. Matched here unconditionally, ahead
    // of that exclusion, exactly as Clerk's own dashboard requires.
    '/__clerk/:path*',
  ],
};
