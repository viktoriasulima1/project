import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.0',
    environment: process.env.NODE_ENV ?? 'unknown',
    // Sprint 13: lets a bug report or screenshot be tied to the exact build
    // that produced it — set via PILOT_VERSION in the deployed environment,
    // not hardcoded, since this route is version-agnostic otherwise.
    pilotVersion: process.env.PILOT_VERSION ?? 'not-set',
  };

  // Database connectivity check
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (e) {
    checks.database = 'error';
    return NextResponse.json({ ...checks, status: 'degraded' }, { status: 503 });
  }

  return NextResponse.json(checks, { status: 200 });
}
