'use client';
import Link from 'next/link';
import { useOffline } from '@/offline/OfflineProvider';
import styles from './OfflineStatus.module.css';

export function OfflineStatus() {
  const { connectivity, drafts, syncingCount, offlineSupportEnabled } = useOffline();
  const waiting = drafts.filter((d) => d.status === 'ready_to_sync' || d.status === 'failed').length;
  const conflicts = drafts.filter((d) => d.status === 'conflict' || d.status === 'needs_review').length;
  const label = !offlineSupportEnabled ? 'Offline support disabled'
    : connectivity === 'offline' ? 'Offline — changes stay on this device'
    : connectivity === 'checking' || connectivity === 'unstable' ? 'Reconnecting'
    : syncingCount ? `Syncing ${syncingCount} item${syncingCount === 1 ? '' : 's'}`
    : conflicts ? `${conflicts} item${conflicts === 1 ? '' : 's'} need review`
    : waiting ? `${waiting} item${waiting === 1 ? '' : 's'} waiting to sync` : 'All changes synced';
  return <Link href="/offline" className={`${styles.status} ${styles[connectivity] ?? ''}`} aria-label={`${label}. Open Offline and Sync.`}><span role="status">{label}</span></Link>;
}
