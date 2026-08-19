export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { isClerkConfigured } from '@/lib/clerk-config';
import { MobileDiagnostics } from '@/components/dev/MobileDiagnostics';

export const metadata = { title: 'Mobile diagnostics — FarmOS (dev)' };

// Development-only. In production this route does not exist (404), so it can
// never leak diagnostics from a real deployment.
export default function MobileDiagnosticsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  // Pass only a boolean (never the key itself) and the app version.
  const clerkConfigured = isClerkConfigured(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const appVersion = process.env.npm_package_version ?? '0.2.0';
  return <MobileDiagnostics clerkConfigured={clerkConfigured} appVersion={appVersion} />;
}
