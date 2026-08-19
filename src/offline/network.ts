export type ConnectivityState = 'online' | 'offline' | 'unstable' | 'checking';

const HEALTH_TIMEOUT_MS = 4000;

export async function checkConnectivity(signal?: AbortSignal): Promise<ConnectivityState> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch('/api/health', { cache: 'no-store', signal: controller.signal });
    return response.ok ? 'online' : 'unstable';
  } catch {
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'unstable';
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export function backoffDelay(attempt: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempt - 1));
}
