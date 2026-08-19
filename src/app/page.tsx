export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

// Sprint 12 finding: this route had no dynamic APIs (no cookies/headers/
// searchParams), so Next.js statically prerendered it (built output showed
// "○ (Static)") — its redirect() got baked into a cached RSC payload at
// build time. A client-side navigation here (e.g. Clerk's signOut() sending
// the browser to afterSignOutUrl="/") could then serve that stale cached
// payload instead of re-resolving the redirect per request. force-dynamic
// guarantees this always re-evaluates, matching every other top-level page
// in this app (dashboard, fields, activities, onboarding all set it too).
export default function RootPage() {
  redirect('/dashboard');
}
