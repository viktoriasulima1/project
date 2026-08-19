import type { Locale } from '@/i18n/locales';
import type { Translate } from '@/i18n/translator';
import type { UserFacingError } from '@/lib/user-error';

export interface UserErrorDisplayModel {
  title: string;
  message: string;
  fieldMessage?: string;
  actionLabels: { retry?: string; signIn?: string; openSyncCenter?: string };
  retryable: boolean;
  announcement: string;
  correlationId?: string;
}

export function buildUserErrorDisplayModel({ translator, locale: _locale, error }: {
  translator: Translate;
  locale: Locale;
  error: UserFacingError;
}): UserErrorDisplayModel {
  const variables = error.metadata == null ? undefined : Object.fromEntries(
    Object.entries(error.metadata).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value)]),
  );
  const message = translator(error.code, variables);
  const title = translator(`titles.${error.category}`);
  const actionLabels = error.category === 'authentication'
    ? { signIn: translator('actions.signInAgain') }
    : error.category === 'offline'
      ? { retry: error.retryable ? translator('actions.retry') : undefined, openSyncCenter: translator('actions.openSyncCenter') }
      : { retry: error.retryable ? translator('actions.retry') : undefined };
  return {
    title,
    message,
    fieldMessage: error.field ? message : undefined,
    actionLabels,
    retryable: error.retryable,
    announcement: `${title}: ${message}`,
    correlationId: error.correlationId,
  };
}
