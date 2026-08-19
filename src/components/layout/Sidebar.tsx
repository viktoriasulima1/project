'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { ReportProblemButton } from './ReportProblemButton';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslations } from '@/i18n/LocaleProvider';
import styles from './Sidebar.module.css';

// href + icon are stable; every visible label (item and group) comes from
// the `navigation` namespace (translation key), never a hardcoded string.
// Grouped by how a farmer actually works the list, not by the order features
// were built in — a flat 18-item list stopped being scannable once Soil,
// Nutrients, Team and Machines landed in the same sprint (see the European
// market pain-point review: 77% of farmers cite complex navigation as a
// daily slowdown).
const navGroups = [
  {
    key: 'overview',
    items: [{ href: '/dashboard', key: 'today', symbol: '◈' }],
  },
  {
    key: 'field',
    items: [
      { href: '/fields', key: 'fields', symbol: '▦' },
      { href: '/fields/map', key: 'fieldMap', symbol: '⌖' },
      { href: '/soil', key: 'soil', symbol: '⬢' },
      { href: '/nutrients', key: 'nutrients', symbol: '❋' },
    ],
  },
  {
    key: 'operations',
    items: [
      { href: '/scouting', key: 'scouting', symbol: '◎' },
      { href: '/planning', key: 'seasonPlan', symbol: '▤' },
      { href: '/work-orders', key: 'workOrders', symbol: '✓' },
      { href: '/activities', key: 'activities', symbol: '✎' },
    ],
  },
  {
    key: 'resources',
    items: [
      { href: '/inventory', key: 'inventory', symbol: '◫' },
      { href: '/team', key: 'team', symbol: '☺' },
      { href: '/machines', key: 'machines', symbol: '⚙' },
    ],
  },
  {
    key: 'financeCompliance',
    items: [
      { href: '/finance', key: 'finance', symbol: '€' },
      { href: '/compliance', key: 'compliance', symbol: '✓' },
      { href: '/reports', key: 'reports', symbol: '▤' },
    ],
  },
  {
    key: 'more',
    items: [
      { href: '/weather', key: 'weather', symbol: '◌' },
      { href: '/ai', key: 'insights', symbol: '✦' },
      { href: '/offline', key: 'offlineSync', symbol: '↻' },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  // Mobile-only: the sidebar is a fixed-width column with nothing to hide it
  // below 768px otherwise (found during Sprint 12's mobile pass — it used to
  // just permanently occupy ~55% of a 390px-wide screen).
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Drawer a11y: Escape closes and returns focus to the toggle. Listener is
  // attached only while open and cleaned up — bounded, no per-render churn.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setMobileOpen(false); toggleRef.current?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const closeDrawer = () => { setMobileOpen(false); toggleRef.current?.focus(); };

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className={styles.mobileToggle}
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? t('closeNav') : t('openNav')}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {mobileOpen && (
        <div className={styles.backdrop} onClick={closeDrawer} aria-hidden="true" />
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ''}`}>
        {/* Farm identity */}
        <div className={styles.brand}>
          <span className={styles.brandIcon}>✦</span>
          <span className={styles.brandName}>FarmOS</span>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {navGroups.map((group) => (
            <div key={group.key} className={styles.navGroup}>
              <span className={styles.navGroupLabel}>{t(`groups.${group.key}`)}</span>
              <ul className={styles.navList}>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                      >
                        <span className={styles.navSymbol}>{item.symbol}</span>
                        <span className={styles.navLabel}>{t(item.key)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={styles.footer}>
          <LanguageSwitcher />
          <ThemeToggle />
          <ReportProblemButton />
          <span className={styles.footerText}>FarmOS · {process.env.NEXT_PUBLIC_BUILD_VERSION ?? '0.2.0'}</span>
        </div>
      </aside>
    </>
  );
}
