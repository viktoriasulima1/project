'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function FarmError({ error, reset }: Props) {
  useEffect(() => {
    // Log to console in dev; replace with Sentry/error tracker in production
    console.error('[FarmOS Error]', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '40px',
      textAlign: 'center',
      gap: '16px',
    }}>
      <div style={{ fontSize: '32px' }}>⚠</div>
      <h2 style={{
        fontSize: 'var(--font-lg)',
        fontWeight: 600,
        color: 'var(--color-text)',
        margin: 0,
      }}>
        Something went wrong
      </h2>
      <p style={{
        fontSize: 'var(--font-sm)',
        color: 'var(--color-text-muted)',
        margin: 0,
        maxWidth: '400px',
      }}>
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      {error.digest && (
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
          Error ID: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button
          onClick={reset}
          style={{
            padding: '8px 20px',
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-sm)',
            fontWeight: 500,
          }}
        >
          Try again
        </button>
        <a
          href="/dashboard"
          style={{
            padding: '8px 20px',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-sm)',
            textDecoration: 'none',
          }}
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
