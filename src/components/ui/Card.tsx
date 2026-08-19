import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Visually highlights the card (e.g. AI briefing) */
  featured?: boolean;
}

export function Card({ children, className = '', featured = false }: CardProps) {
  return (
    <div className={`${styles.card} ${featured ? styles.featured : ''} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: string;
}

export function CardHeader({ title, subtitle, actions, icon }: CardHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <div>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md';
}

export function CardBody({ children, padding = 'md' }: CardBodyProps) {
  return (
    <div className={`${styles.body} ${styles[`padding-${padding}`]}`}>
      {children}
    </div>
  );
}
