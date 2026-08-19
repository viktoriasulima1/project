import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Sprint 27 — HMAC signing for the FarmOS internal signed-read route
 * (`/api/scouting/photos/[id]`). Extracted into a leaf module so both the local
 * and the S3-compatible storage adapters can produce the same client-facing
 * signed FarmOS URL without a circular import. The signing secret is server-only.
 */
function secret() {
  const value = process.env.SCOUTING_PHOTO_SIGNING_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('Private photo signing is not configured.');
  return 'local-e2e-photo-secret-not-for-production';
}

export function signPhotoRead(photoId: string, expiresSeconds = 300) {
  const exp = Math.floor(Date.now() / 1000) + expiresSeconds;
  return { exp, signature: createHmac('sha256', secret()).update(`${photoId}.${exp}`).digest('hex') };
}

export function verifyPhotoRead(photoId: string, exp: number, signature: string) {
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac('sha256', secret()).update(`${photoId}.${exp}`).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'hex'); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
