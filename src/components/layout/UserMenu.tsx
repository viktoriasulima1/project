'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import { isClerkConfigured } from '@/lib/clerk-config';
import styles from './UserMenu.module.css';

const clerkEnabled = isClerkConfigured(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

interface UserMenuProps {
  farmName?: string;
}

// Split so the Clerk hooks (useUser) are only ever called from a component
// that's actually rendered inside <ClerkProvider> — never mounted at all
// when Clerk isn't configured, rather than mounted-then-erroring.
export function UserMenu({ farmName }: UserMenuProps) {
  if (!clerkEnabled) return null;
  return <UserMenuInner farmName={farmName} />;
}

function UserMenuInner({ farmName }: UserMenuProps) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return null;

  const displayName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Account';

  return (
    <div className={styles.menu}>
      {farmName && <span className={styles.farmName}>{farmName}</span>}
      <span className={styles.divider} />
      <span className={styles.userName}>{displayName}</span>
      <UserButton />
    </div>
  );
}
