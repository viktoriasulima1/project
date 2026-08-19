import 'server-only';
import { db } from '@/lib/db';
import { isSupportedLocale } from './locales';

/**
 * Cross-device user locale preference (Part 3), Clerk-user scoped.
 *
 * Accessed through a minimal structural view of the Prisma delegate so this
 * module compiles whether or not `prisma generate` has been run in the current
 * environment, and every call is defensive: if the table does not exist yet
 * (migration pending) the read/write is swallowed and the caller falls back to
 * the locale cookie. No farmId is ever accepted from the client; a user can only
 * read/write their OWN row (keyed by the server-resolved clerkUserId).
 */
interface LocalePrefDelegate {
  findUnique(args: { where: { clerkUserId: string }; select?: { locale: true } }): Promise<{ locale: string } | null>;
  upsert(args: {
    where: { clerkUserId: string };
    create: { clerkUserId: string; locale: string };
    update: { locale: string };
  }): Promise<{ locale: string }>;
}

function delegate(): LocalePrefDelegate | null {
  const candidate = (db as unknown as { userLocalePreference?: LocalePrefDelegate }).userLocalePreference;
  return candidate ?? null;
}

export async function getUserLocalePreference(clerkUserId: string): Promise<string | null> {
  if (!clerkUserId) return null;
  try {
    const row = await delegate()?.findUnique({ where: { clerkUserId }, select: { locale: true } });
    return row && isSupportedLocale(row.locale) ? row.locale : null;
  } catch {
    return null; // table pending migration, or DB unavailable
  }
}

export async function saveUserLocalePreference(clerkUserId: string, locale: string): Promise<boolean> {
  if (!clerkUserId || !isSupportedLocale(locale)) return false;
  try {
    await delegate()?.upsert({ where: { clerkUserId }, create: { clerkUserId, locale }, update: { locale } });
    return true;
  } catch {
    return false; // best-effort: cookie still carries the choice
  }
}
