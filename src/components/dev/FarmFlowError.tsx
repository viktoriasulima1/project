'use client';

import { useEffect, useState } from 'react';
import { recordRuntimeError } from '@/lib/dev/runtime-telemetry';
import styles from './FarmFlowError.module.css';

/**
 * Shared recovery UI for the interactive farm flows (scouting, activity, field
 * map, offline). Rendered by each segment's `error.tsx` Client Component when
 * an uncaught client exception escapes React rendering.
 *
 * Honesty rule: this promises only that a draft *already saved on the device*
 * is not deleted — it never claims that in-memory-only, unsaved data was
 * persisted. Interactive drafts here are autosaved to IndexedDB, so that
 * assurance is accurate; a farmer who never triggered a local save still keeps
 * whatever was previously stored.
 */
export function FarmFlowError({
  error,
  reset,
  boundary,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  boundary: string;
}) {
  const [diagnosticId, setDiagnosticId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Record once per surfaced error. The recorder is a no-op in production.
    setDiagnosticId(recordRuntimeError({ error, boundary, userAction: 'render' }));
  }, [error, boundary]);

  async function copyId() {
    const value = error.digest ? `${diagnosticId} (${error.digest})` : diagnosticId;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.wrap} role="alert" aria-live="assertive">
      <div className={styles.icon} aria-hidden="true">⚠</div>
      <h2 className={styles.title}>FarmOS encountered a display error.</h2>
      <p className={styles.body}>Your locally saved draft has not been deleted.</p>
      {diagnosticId && (
        <p className={styles.diagnostic}>
          Diagnostic ID: <code>{diagnosticId}</code>
          {error.digest ? ` · ${error.digest}` : ''}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={reset}>Try again</button>
        <a className={styles.secondary} href="/dashboard">Return to Today</a>
        <button type="button" className={styles.secondary} onClick={copyId}>
          {copied ? 'Copied ✓' : 'Copy diagnostic ID'}
        </button>
      </div>
    </div>
  );
}
