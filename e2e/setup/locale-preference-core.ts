import { isSupportedLocale } from '../../src/i18n/locales';

/**
 * Pure, DB-agnostic helpers behind the E2E UserLocalePreference reset/seed
 * helpers. Kept free of Prisma/Playwright imports so they are unit-testable with
 * a mock delegate, proving the reset is user-scoped (never cross-user).
 */
export interface LocalePrefDelegate {
  deleteMany(args: { where: { clerkUserId: string } }): Promise<{ count: number }>;
  findUnique(args: { where: { clerkUserId: string }; select: { locale: true } }): Promise<{ locale: string } | null>;
  upsert(args: {
    where: { clerkUserId: string };
    create: { clerkUserId: string; locale: string };
    update: { locale: string };
  }): Promise<{ locale: string }>;
}

/** Structural view of the Prisma delegate — works whether or not the client has
 *  been regenerated with the UserLocalePreference model in this environment. */
export function localePrefDelegate(client: unknown): LocalePrefDelegate | null {
  const candidate = (client as { userLocalePreference?: LocalePrefDelegate }).userLocalePreference;
  return candidate ?? null;
}

export async function resetLocalePreference(delegate: LocalePrefDelegate | null, clerkUserId: string): Promise<number> {
  if (!delegate || !clerkUserId) return 0;
  const result = await delegate.deleteMany({ where: { clerkUserId } }); // ONLY this user's row
  return result.count;
}

export async function writeLocalePreference(delegate: LocalePrefDelegate | null, clerkUserId: string, locale: string): Promise<boolean> {
  if (!delegate || !clerkUserId || !isSupportedLocale(locale)) return false;
  await delegate.upsert({ where: { clerkUserId }, create: { clerkUserId, locale }, update: { locale } });
  return true;
}

export async function readLocalePreference(delegate: LocalePrefDelegate | null, clerkUserId: string): Promise<string | null> {
  if (!delegate || !clerkUserId) return null;
  const row = await delegate.findUnique({ where: { clerkUserId }, select: { locale: true } });
  return row?.locale ?? null;
}
