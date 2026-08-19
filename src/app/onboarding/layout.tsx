import type { ReactNode } from 'react';
import styles from './layout.module.css';

// Deliberately outside the (farm) route group / AppShell: a user with no
// farm yet has nothing for the farm nav sidebar to point at, and showing it
// would invite navigating away mid-setup into pages that immediately
// redirect back here.
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <div className={styles.page}>{children}</div>;
}
