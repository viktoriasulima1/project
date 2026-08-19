'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className}`}
      disabled={disabled ?? loading}
      {...rest}
    >
      {/* Always rendered — display toggled via CSS, not mount/unmount, so a
          loading-state flip never removes/inserts a DOM node for React to
          reconcile against a stale sibling reference. */}
      <span className={`${styles.spinner} ${loading ? styles.spinnerVisible : ''}`} aria-hidden="true" />
      {children}
    </button>
  );
}
