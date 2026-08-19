const LOCK_NAME = 'farmos-offline-sync';
const LEASE_MS = 30_000;

export async function withQueueLock<T>(namespace: string, task: () => Promise<T>): Promise<T | null> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (locks?.request) return locks.request(`${LOCK_NAME}:${namespace}`, { ifAvailable: true }, async (lock) => lock ? task() : null);
  // Safari fallback. Server idempotency remains the exact-once guard if two contexts race.
  if (typeof localStorage === 'undefined') return task();
  const key = `${LOCK_NAME}:${namespace}`;
  const owner = crypto.randomUUID();
  const current = Number(localStorage.getItem(key)?.split(':')[0] ?? 0);
  if (current > Date.now()) return null;
  localStorage.setItem(key, `${Date.now() + LEASE_MS}:${owner}`);
  if (!localStorage.getItem(key)?.endsWith(owner)) return null;
  try { return await task(); }
  finally { if (localStorage.getItem(key)?.endsWith(owner)) localStorage.removeItem(key); }
}
