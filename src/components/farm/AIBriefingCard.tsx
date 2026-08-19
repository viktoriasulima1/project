import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { AIBriefingItem, TaskPriority } from '@/types/farm';
import styles from './AIBriefingCard.module.css';

const MODULE_PATHS: Record<string, string> = {
  dashboard: '/dashboard',
  fields: '/fields',
  activities: '/activities',
  inventory: '/inventory',
  finance: '/finance',
  weather: '/weather',
  compliance: '/compliance',
  ai: '/ai',
};

const PRIORITY_VARIANT: Record<TaskPriority, 'red' | 'amber' | 'blue'> = {
  high: 'red',
  medium: 'amber',
  low: 'blue',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

interface AIBriefingCardProps {
  items: AIBriefingItem[];
  farmName: string;
}

export function AIBriefingCard({ items, farmName }: AIBriefingCardProps) {
  const date = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Card featured>
      <CardHeader
        icon="✦"
        title={`Daily Farm Briefing — ${farmName}`}
        subtitle={`${date} · Rule-based farm facts`}
      />
      <div className={styles.body}>
        {items.length === 0 ? (
          <p className={styles.empty}>Nothing critical is due today. Review ready Work Orders for this week.</p>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id} className={`${styles.item} ${styles[item.priority]}`}>
                <div className={styles.itemTop}>
                  <Badge variant={PRIORITY_VARIANT[item.priority]} size="sm">
                    {PRIORITY_LABEL[item.priority]}
                  </Badge>
                  <span className={styles.itemTitle}>{item.title}</span>
                </div>
                <p className={styles.itemExplanation}>{item.explanation}</p>
                {item.actionLabel && (
                  <Link
                    href={MODULE_PATHS[item.relatedModule] ?? '/dashboard'}
                    className={styles.itemAction}
                  >
                    {item.actionLabel} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
