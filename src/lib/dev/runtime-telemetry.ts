/**
 * Development-only safe runtime error recorder.
 *
 * Captures just enough context to diagnose a client crash (like the physical
 * iPhone "Maximum call stack size exceeded") WITHOUT capturing anything
 * sensitive: no Clerk tokens, no farmer free-text, no microphone audio, no
 * photo bytes, no cookies, no database secrets. Every visible error fallback
 * surfaces a short copyable diagnostic ID that maps to one of these records.
 *
 * This module is a no-op in production builds — records are never collected and
 * the buffer stays empty — so it can be imported freely.
 */
import { safeSerialize } from '@/lib/runtime-safety';

export const RUNTIME_TELEMETRY_ENABLED = process.env.NODE_ENV !== 'production';

export interface RuntimeErrorRecord {
  id: string;
  errorName: string;
  safeMessage: string;
  route: string;
  boundary: string;
  timestamp: string;
  userAction: string | null;
  translationLikely: boolean;
  viewport: { width: number; height: number } | null;
  online: boolean | null;
}

export interface RecordRuntimeErrorInput {
  error: unknown;
  boundary: string;
  route?: string;
  userAction?: string | null;
}

const MAX_RECORDS = 25;
const buffer: RuntimeErrorRecord[] = [];

/** Short, human-copyable id (e.g. "FARM-8F3K2Q"). Not security-sensitive. */
export function makeDiagnosticId(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FARM-${rand}`;
}

/**
 * Redact anything that could be a secret before it is stored or shown. Caps
 * length and strips token-shaped substrings and email addresses. Errors thrown
 * by validation/enum checks are safe to keep, but we never assume a message is
 * clean.
 */
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\b(pk|sk)_(test|live)_[A-Za-z0-9]+/g, '[redacted-key]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9._-]{10,}/g, '[redacted-jwt]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
    .slice(0, 300);
}

/**
 * Best-effort heuristic for "the page is currently being machine-translated by
 * the browser". Google Translate stamps `translated-ltr` / `translated-rtl` on
 * <html> and injects <font> wrappers around text nodes. This is a hint for
 * triage only — never a value the app depends on.
 */
export function detectTranslationLikely(doc?: Document): boolean {
  const d = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!d) return false;
  const html = d.documentElement;
  if (!html) return false;
  if (html.classList.contains('translated-ltr') || html.classList.contains('translated-rtl')) return true;
  if (html.getAttribute('translate') === 'yes') return true;
  // Google Translate wraps translated text in <font> tags — extremely rare in
  // hand-written app markup, so their presence is a strong signal.
  return d.getElementsByTagName('font').length > 0;
}

export function recordRuntimeError(input: RecordRuntimeErrorInput): string {
  const id = makeDiagnosticId();
  if (!RUNTIME_TELEMETRY_ENABLED) return id;

  const err = input.error;
  const errorName = err instanceof Error ? err.name : 'Error';
  const rawMessage = err instanceof Error ? err.message : String(err);

  const record: RuntimeErrorRecord = {
    id,
    errorName,
    safeMessage: sanitizeErrorMessage(rawMessage),
    route: input.route ?? (typeof location !== 'undefined' ? location.pathname : 'unknown'),
    boundary: input.boundary,
    timestamp: new Date().toISOString(),
    userAction: input.userAction ?? null,
    translationLikely: detectTranslationLikely(),
    viewport: typeof window !== 'undefined' ? { width: window.innerWidth, height: window.innerHeight } : null,
    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
  };

  buffer.push(record);
  if (buffer.length > MAX_RECORDS) buffer.shift();
  // safeSerialize guarantees the console dump can't overflow on a cyclic error.
  // eslint-disable-next-line no-console
  console.error('[FarmOS runtime telemetry]', safeSerialize(record));
  return id;
}

export function getRecentRuntimeErrors(): RuntimeErrorRecord[] {
  return RUNTIME_TELEMETRY_ENABLED ? [...buffer] : [];
}

/** Test/diagnostics helper — clears the dev buffer. */
export function clearRuntimeErrors(): void {
  buffer.length = 0;
}
