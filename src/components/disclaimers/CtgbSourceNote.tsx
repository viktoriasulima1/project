import styles from './disclaimers.module.css';

export const CTGB_DISCLAIMER_TEXT =
  'Always verify the current authorised label, dose, crop, and BBCH restrictions on the official product label or ctgb.nl before application. FarmOS does not guarantee legal compliance.';

interface CtgbSourceNoteProps {
  sourceUrl?: string;
  fetchedAt?: string;
  authorisationStatus?: 'authorised' | 'expired' | 'withdrawn' | 'suspended' | 'unknown';
  isIncomplete?: boolean;
  isManualEntry?: boolean;
  /** Compact = one line for inline use (e.g. inside the spray form);
   * false = full panel (e.g. the inventory item detail). */
  compact?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  authorised: 'Authorised',
  expired: 'Authorisation expired',
  withdrawn: 'Authorisation withdrawn',
  suspended: 'Authorisation suspended',
  unknown: 'Status unknown',
};

/**
 * The single place Ctgb-sourced-data language is written (Sprint 18 Part
 * 14). Every screen that shows Ctgb-derived data must render this rather
 * than writing its own version of the disclaimer.
 */
export function CtgbSourceNote({ sourceUrl, fetchedAt, authorisationStatus, isIncomplete, isManualEntry, compact }: CtgbSourceNoteProps) {
  if (isManualEntry) {
    return (
      <div className={`${styles.note} ${styles.warn}`}>
        <span className={styles.badge}>Unverified</span>
        <span>Manually entered — not validated against the official Ctgb register. {!compact && CTGB_DISCLAIMER_TEXT}</span>
      </div>
    );
  }

  return (
    <div className={`${styles.note} ${authorisationStatus === 'authorised' ? styles.ok : styles.warn}`}>
      {authorisationStatus && <span className={styles.badge}>{STATUS_LABEL[authorisationStatus] ?? 'Status unknown'}</span>}
      {isIncomplete && <span className={styles.badge}>Official data incomplete</span>}
      <span>
        Source: official Ctgb Toelatingendatabank{sourceUrl ? ` (${new URL(sourceUrl).hostname})` : ''}.
        {fetchedAt && ` Last checked ${new Date(fetchedAt).toLocaleString('nl-NL')}.`}
        {!compact && ` ${CTGB_DISCLAIMER_TEXT}`}
      </span>
    </div>
  );
}
