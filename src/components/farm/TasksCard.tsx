import Link from 'next/link';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Task, TaskPriority } from '@/types/farm';
import styles from './TasksCard.module.css';

const PRIORITY_VARIANT: Record<TaskPriority, 'red' | 'amber' | 'blue'> = {
  high: 'red',
  medium: 'amber',
  low: 'blue',
};

const TYPE_SYMBOL: Record<string, string> = {
  spray: '◉',
  fertilize: '◎',
  harvest: '▽',
  scout: '◉',
  order: '◻',
  report: '▤',
  check: '◌',
  sow: '◦',
  irrigate: '◌',
  tillage: '▣',
  soil_sample: '◉',
  other: '◦',
};

function formatDueDate(dateStr: string): string {
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return due.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function isOverdue(dateStr: string): boolean {
  const due = new Date(dateStr);
  due.setHours(23, 59, 59);
  return due < new Date();
}

interface TasksCardProps {
  tasks: Task[];
}

export function TasksCard({ tasks }: TasksCardProps) {
  // Show pending tasks sorted by priority then due date
  const sorted = [...tasks]
    .filter((t) => t.status !== 'done')
    .sort((a, b) => {
      const p: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
      if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority];
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 6);

  const highCount = tasks.filter((t) => t.priority === 'high' && t.status !== 'done').length;

  return (
    <Card>
      <CardHeader
        icon="✎"
        title="Today's Tasks"
        subtitle={`${tasks.filter((t) => t.status !== 'done').length} pending${highCount > 0 ? ` · ${highCount} urgent` : ''}`}
      />
      <CardBody padding="none">
        {sorted.length === 0 ? (
          <p className={styles.empty}>All tasks complete.</p>
        ) : (
          <ul className={styles.list}>
            {sorted.map((task) => {
              const overdue = isOverdue(task.dueDate);
              return (
                <li key={task.id} className={styles.item}>
                  <span className={styles.typeSymbol}>
                    {TYPE_SYMBOL[task.type] ?? '◦'}
                  </span>
                  <div className={styles.info}>
                    <span className={styles.title}>{task.title}</span>
                    <div className={styles.meta}>
                      <Badge variant={PRIORITY_VARIANT[task.priority]} size="sm">
                        {task.priority}
                      </Badge>
                      {task.assignedTo && (
                        <span className={styles.assignee}>{task.assignedTo}</span>
                      )}
                    </div>
                  </div>
                  <span className={`${styles.due} ${overdue ? styles.dueOverdue : ''}`}>
                    {formatDueDate(task.dueDate)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/activities" className={styles.viewAll}>
          View all tasks →
        </Link>
      </CardBody>
    </Card>
  );
}
