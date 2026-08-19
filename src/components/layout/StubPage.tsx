import Link from 'next/link';
import styles from './StubPage.module.css';

interface StubPageProps {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export function StubPage({ icon, title, description, action }: StubPageProps) {
  return (
    <main className={styles.placeholder}>
      <span className={styles.icon}>{icon}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Link href={action.href} className={styles.action}>
          {action.label}
        </Link>
      )}
    </main>
  );
}
