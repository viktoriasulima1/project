import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Loads the authoritative message catalog for a locale so E2E specs assert
 * against the REAL approved translation, not a hardcoded phrase that might drift
 * (Part 6). Returns the namespaces the Fields/Onboarding specs need.
 */
export function loadTestMessages(locale: string) {
  const dir = path.resolve(process.cwd(), 'messages', locale);
  const read = (ns: string) => JSON.parse(readFileSync(path.join(dir, `${ns}.json`), 'utf8'));
  return {
    common: read('common'),
    onboarding: read('onboarding'),
    fields: read('fields'),
    enums: read('enums'),
    errors: read('errors'),
  };
}
