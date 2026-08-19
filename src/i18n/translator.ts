import type { Locale } from './locales';

export type MessageTree = { [key: string]: string | MessageTree };
export type TranslateVars = Record<string, string | number>;
export type Translate = (key: string, vars?: TranslateVars) => string;

/** Dot-path lookup into a nested message tree. */
export function lookup(tree: MessageTree | undefined, key: string): string | undefined {
  if (!tree) return undefined;
  let node: string | MessageTree | undefined = tree;
  for (const part of key.split('.')) {
    if (node == null || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Replaces `{name}` placeholders; unknown placeholders are left literal. */
export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (vars[name] != null ? String(vars[name]) : `{${name}}`));
}

export const IS_DEV = process.env.NODE_ENV !== 'production';

export interface TranslatorOptions {
  /** Already-active messages (locale layer). */
  messages: MessageTree;
  /** English fallback layer, consulted when a key is missing in `messages`. */
  fallback?: MessageTree;
  /** Optional sink for missing-key observability (dev logs / prod events). */
  onMissing?: (key: string) => void;
}

/**
 * Creates a translate function with English fallback. In development a missing
 * key renders `[missing: key]` so it is caught in tests; in production it falls
 * back to English, then to the key itself — a page is never blanked by one
 * missing string (Part 17).
 */
export function createTranslator(locale: Locale, options: TranslatorOptions): Translate {
  const { messages, fallback, onMissing } = options;
  return (key, vars) => {
    const primary = lookup(messages, key);
    if (primary !== undefined) return interpolate(primary, vars);
    const fallbackValue = lookup(fallback, key);
    onMissing?.(key);
    if (fallbackValue !== undefined) return interpolate(fallbackValue, vars);
    return IS_DEV ? `[missing: ${key}]` : key;
  };
}

/** Pluralisation helper using Intl.PluralRules. Keys use category sub-keys. */
export function selectPlural(locale: Locale, count: number): Intl.LDMLPluralRule {
  return new Intl.PluralRules(locale).select(count);
}
