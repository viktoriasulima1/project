import styles from './disclaimers.module.css';

export const BRP_DISCLAIMER_TEXT =
  'This is public national BRP parcel data, not your personal RVO registration. Confirm the boundary and current crop yourself — your current RVO/Mijn percelen declaration may differ.';

interface BrpSourceNoteProps {
  datasetYear?: number;
  compact?: boolean;
}

/**
 * The single place BRP/PDOK-sourced-data language is written (Sprint 18
 * Part 14). See docs/BRP_PDOK_Official_Data_Audit.md, Part 2, for why this
 * distinction (public dataset vs. personal RVO record) must never be
 * blurred — this component is the enforcement point for that rule in the UI.
 */
export function BrpSourceNote({ datasetYear, compact }: BrpSourceNoteProps) {
  return (
    <div className={`${styles.note} ${styles.warn}`}>
      <span className={styles.badge}>Public data{datasetYear ? ` · ${datasetYear}` : ''}</span>
      <span>
        Source: PDOK BRP Gewaspercelen{datasetYear ? ` (${datasetYear} reference year, 15 May peildatum)` : ''}.
        {!compact && ` ${BRP_DISCLAIMER_TEXT}`}
      </span>
    </div>
  );
}
