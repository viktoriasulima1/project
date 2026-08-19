import { UserMenu } from './UserMenu';
import styles from './Topbar.module.css';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Shown in the user menu on the right. Omit when no farm exists yet. */
  farmName?: string;
}

export function Topbar({ title, subtitle, actions, farmName }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      <div className={styles.actions}>
        {actions}
        <UserMenu farmName={farmName} />
      </div>
    </header>
  );
}
