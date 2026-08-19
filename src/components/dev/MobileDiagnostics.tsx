'use client';
import { useEffect, useState } from 'react';

/**
 * Development-only, on-device diagnostics for debugging a tunnelled mobile
 * session. Shows ONLY safe, non-sensitive facts — never a key value, cookie,
 * token, signed URL, or credential. The `clerkConfigured` boolean and
 * `appVersion` are passed from the server without exposing the key itself.
 */
type Row = { label: string; value: string };

export function MobileDiagnostics({ clerkConfigured, appVersion }: { clerkConfigured: boolean; appVersion: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [swStatus, setSwStatus] = useState('checking…');

  useEffect(() => {
    const yn = (b: boolean) => (b ? 'yes' : 'no');
    let localStorageOk = false, indexedDbOk = false;
    try { localStorage.setItem('__farmos_diag', '1'); localStorage.removeItem('__farmos_diag'); localStorageOk = true; } catch { localStorageOk = false; }
    try { indexedDbOk = typeof indexedDB !== 'undefined'; } catch { indexedDbOk = false; }

    setRows([
      { label: 'Current origin', value: window.location.origin },
      { label: 'Secure context (HTTPS)', value: yn(window.isSecureContext) },
      { label: 'Online', value: yn(navigator.onLine) },
      { label: 'Clerk configured (server)', value: yn(clerkConfigured) },
      { label: 'Clerk loaded (window.Clerk)', value: yn(typeof (window as unknown as { Clerk?: unknown }).Clerk !== 'undefined') },
      { label: 'Cookies enabled', value: yn(navigator.cookieEnabled) },
      { label: 'localStorage available', value: yn(localStorageOk) },
      { label: 'IndexedDB available', value: yn(indexedDbOk) },
      { label: 'Camera API available', value: yn(Boolean(navigator.mediaDevices?.getUserMedia)) },
      { label: 'Microphone API available', value: yn(Boolean(navigator.mediaDevices?.getUserMedia)) },
      { label: 'Service worker API', value: yn('serviceWorker' in navigator) },
      { label: 'User agent', value: navigator.userAgent },
      { label: 'Application version', value: appVersion },
    ]);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => setSwStatus(regs.length ? `${regs.length} registration(s), controller: ${navigator.serviceWorker.controller ? 'active' : 'none'}` : 'none registered'))
        .catch(() => setSwStatus('unavailable'));
    } else setSwStatus('unsupported');
  }, [clerkConfigured, appVersion]);

  async function resetServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); }
    setSwStatus('cleared — reload to re-register');
  }

  const cell: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--color-border, #30363d)', fontSize: 13, verticalAlign: 'top' };
  return (
    <main style={{ padding: 20, maxWidth: 720, margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: 'var(--color-text, #e6edf3)' }}>
      <h1 style={{ fontSize: 20 }}>FarmOS mobile diagnostics <span style={{ fontSize: 12, color: 'var(--color-text-muted, #8b949e)' }}>(development only)</span></h1>
      <p style={{ color: 'var(--color-text-muted, #8b949e)', fontSize: 13 }}>Safe facts only — no keys, cookies, tokens, or URLs are shown.</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ ...cell, fontWeight: 600 }}>Service worker</td><td style={cell}>{swStatus}</td></tr>
            {rows.map((r) => (
              <tr key={r.label}><td style={{ ...cell, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.label}</td><td style={{ ...cell, wordBreak: 'break-all' }}>{r.value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={resetServiceWorker} style={{ marginTop: 14, padding: '8px 12px', borderRadius: 7, border: '1px solid var(--color-border, #30363d)', background: 'var(--color-surface, #161b22)', color: 'inherit', cursor: 'pointer' }}>
        Unregister service worker + clear caches (dev cleanup)
      </button>
    </main>
  );
}
