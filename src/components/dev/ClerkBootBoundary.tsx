'use client';
import { Component, type ReactNode } from 'react';

/**
 * Development-only error boundary. If the Clerk-wrapped app subtree throws during
 * render (e.g. a misconfiguration or a failed auth-UI initialization), show a
 * clear, safe message instead of a blank body. Mounted ONLY in development by
 * the root layout — production keeps Next.js's normal error handling untouched.
 * Never exposes secrets or a raw internal error.
 */
export class ClerkBootBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Console only (dev) — the visible UI stays generic and secret-free.
    console.error('[ClerkBootBoundary] app render failed:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', background: 'var(--color-bg, #0d1117)', color: 'var(--color-text, #e6edf3)', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: 460 }}>
            <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Authentication UI failed to load.</p>
            <p style={{ color: 'var(--color-text-muted, #8b949e)' }}>Check the browser console and Clerk development configuration. (Development-only message.)</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
