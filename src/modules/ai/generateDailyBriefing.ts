import type {
  AIBriefingItem,
  DashboardData,
  TaskPriority,
} from '@/types/farm';

// Legacy deterministic rule-based briefing generator. It is not an AI model.
// The live Dashboard uses shared Farm Insights; Sprint 26's optional language
// layer is vendor-neutral and lives behind src/lib/ai/provider.ts.
export function generateDailyBriefing(data: DashboardData): AIBriefingItem[] {
  const items: AIBriefingItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1. Spray window — highest-value daily hook
  const todayForecast = data.weather.days[0];
  const tomorrowForecast = data.weather.days[1];
  if (todayForecast) {
    const openDays = data.weather.days.filter((d) => d.sprayWindow === 'open');
    if (openDays.length > 0) {
      const closesOn = data.weather.days.find((d) => d.sprayWindow !== 'open');
      const closesText = closesOn
        ? `Window closes ${formatShortDate(closesOn.date)}.`
        : 'Good conditions ahead.';
      items.push({
        id: 'ai-spray-window',
        priority: 'high',
        title: `Spray window open — ${openDays.length} day${openDays.length !== 1 ? 's' : ''} available`,
        explanation: `${todayForecast.windSpeedKmh} km/h ${todayForecast.windDirection} wind, ${todayForecast.rainMm} mm rain today. ${closesText} Check pending spray tasks.`,
        relatedModule: 'activities',
        actionLabel: 'Log spray activity',
      });
    } else if (todayForecast.sprayWindow === 'closed' && tomorrowForecast?.sprayWindow === 'closed') {
      items.push({
        id: 'ai-spray-closed',
        priority: 'low',
        title: 'No spray window today or tomorrow',
        explanation: `Rain ${todayForecast.rainMm} mm, wind ${todayForecast.windSpeedKmh} km/h. Plan office tasks or scouting on foot.`,
        relatedModule: 'weather',
        actionLabel: 'View forecast',
      });
    }
  }

  // 2. Inventory below minimum
  const lowStock = data.inventoryAlerts.filter(
    (item) => item.currentStock < item.minimumStock
  );
  if (lowStock.length > 0) {
    const names = lowStock.map((i) => i.name).join(', ');
    const priority: TaskPriority = lowStock.length >= 2 ? 'high' : 'medium';
    items.push({
      id: 'ai-low-stock',
      priority,
      title: `${lowStock.length} product${lowStock.length !== 1 ? 's' : ''} below minimum stock`,
      explanation: `${names}. Order before planned applications to avoid delays.`,
      relatedModule: 'inventory',
      actionLabel: 'View inventory',
    });
  }

  // 3. Products expiring within 30 days
  const expiring = data.inventoryAlerts.filter((item) => {
    if (!item.expiryDate) return false;
    const expiry = new Date(item.expiryDate);
    return expiry >= today && expiry <= in30Days;
  });
  if (expiring.length > 0) {
    items.push({
      id: 'ai-expiring',
      priority: 'medium',
      title: `${expiring.length} product${expiring.length !== 1 ? 's' : ''} expiring within 30 days`,
      explanation: `${expiring.map((i) => `${i.name} (${formatShortDate(i.expiryDate!)})`).join(', ')}. Use or plan disposal.`,
      relatedModule: 'inventory',
      actionLabel: 'View inventory',
    });
  }

  // 4. Fields needing attention
  const attentionFields = data.fields.filter(
    (f) => f.status === 'attention' || f.status === 'critical'
  );
  if (attentionFields.length > 0) {
    const field = attentionFields[0];
    const priority: TaskPriority = attentionFields.some((f) => f.status === 'critical')
      ? 'high'
      : 'medium';
    items.push({
      id: 'ai-field-stress',
      priority,
      title: `${attentionFields.length > 1 ? `${attentionFields.length} fields need` : `"${field.name}" needs`} attention`,
      explanation: `${field.name}: NDVI ${field.ndviScore ?? '–'}. Scout recommended before next input application.`,
      relatedModule: 'fields',
      actionLabel: 'View field',
    });
  }

  // 5. Overdue tasks
  const overdue = data.tasks.filter((t) => {
    const due = new Date(t.dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today && t.status !== 'done';
  });
  if (overdue.length > 0) {
    items.push({
      id: 'ai-overdue',
      priority: 'high',
      title: `${overdue.length} overdue task${overdue.length !== 1 ? 's' : ''}`,
      explanation: overdue
        .slice(0, 2)
        .map((t) => `"${t.title}"`)
        .join(', ') + (overdue.length > 2 ? ` +${overdue.length - 2} more` : '') + '.',
      relatedModule: 'dashboard',
      actionLabel: 'View tasks',
    });
  }

  // 6. Finance — over budget flag
  if (data.finance.budgetVarianceEur < -5000) {
    items.push({
      id: 'ai-finance-warning',
      priority: 'medium',
      title: `Input costs over budget by €${Math.abs(data.finance.budgetVarianceEur).toLocaleString('nl-NL')}`,
      explanation: `Season cost: €${data.finance.costPerHectareEur.toLocaleString('nl-NL')}/ha. Estimated margin still positive at €${data.finance.estimatedMarginPerHaEur}/ha.`,
      relatedModule: 'finance',
      actionLabel: 'View finance',
    });
  } else if (data.finance.estimatedMarginPerHaEur > 0) {
    items.push({
      id: 'ai-finance-ok',
      priority: 'medium',
      title: `Season margin on track: €${data.finance.estimatedMarginPerHaEur}/ha`,
      explanation: `Total costs: €${data.finance.costPerHectareEur.toLocaleString('nl-NL')}/ha. Revenue: €${data.finance.totalRevenueEur.toLocaleString('nl-NL')} recorded so far.`,
      relatedModule: 'finance',
      actionLabel: 'View finance',
    });
  }

  // 7. Compliance — missing or expiring items
  const complianceIssues = data.compliance.filter(
    (c) => c.status === 'missing' || c.status === 'expiring' || c.status === 'expired'
  );
  if (complianceIssues.length > 0) {
    const urgent = complianceIssues[0];
    items.push({
      id: 'ai-compliance',
      priority: urgent.status === 'expired' ? 'high' : 'medium',
      title: `Compliance: ${urgent.title}`,
      explanation:
        urgent.description + (urgent.dueDate ? ` — due ${formatShortDate(urgent.dueDate)}.` : '.'),
      relatedModule: 'compliance',
      actionLabel: 'View compliance',
    });
  }

  // Sort: high → medium → low, then limit to top 5
  const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  return items
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 5);
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
  });
}
