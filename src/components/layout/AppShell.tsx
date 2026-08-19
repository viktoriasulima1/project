import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { QuickLogButton } from '@/components/activities/QuickLogButton';
import styles from './AppShell.module.css';
import { OfflineProvider } from '@/offline/OfflineProvider';
import { OfflineStatus } from '@/components/offline/OfflineStatus';

interface AppShellProps {
  children: ReactNode;
  farmId: string;
  userRef: string;
}

// AppShell wraps Sidebar (client) + main content area.
// Keep this as a Server Component — Sidebar and QuickLogButton handle their
// own client needs. QuickLogButton lives here (not per-page) so every farm
// page gets the same entry point without each one fetching its own
// field/product/machine lists just to render a button.
export function AppShell({ children, farmId, userRef }: AppShellProps) {
  return (
    <OfflineProvider farmId={farmId} userRef={userRef}>
      <div className={styles.shell}>
        <Sidebar />
        <div className={styles.content}>
          <OfflineStatus />
          {children}
        </div>
        <QuickLogButton />
      </div>
    </OfflineProvider>
  );
}
