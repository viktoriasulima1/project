/**
 * Locale validation (Part 4).  `npm run i18n:validate`
 *
 * en-GB is the authoritative schema. For every other locale this checks invalid
 * JSON, missing keys, extra/unknown keys, empty translations and placeholder
 * mismatches, and warns on longer strings byte-identical to English. Exits
 * non-zero on any error so it can gate CI/build. Pure diff logic lives in
 * src/i18n/validate-core.ts (unit-tested).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { diffNamespace, flatten, type Tree } from '../src/i18n/validate-core';

const MESSAGES_DIR = path.resolve(process.cwd(), 'messages');
const AUTHORITATIVE = 'en-GB';

function loadNamespace(locale: string, namespace: string): Tree | null {
  const file = path.join(MESSAGES_DIR, locale, `${namespace}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as Tree;
}

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  const locales = readdirSync(MESSAGES_DIR).filter((name) => existsSync(path.join(MESSAGES_DIR, name)));
  if (!locales.includes(AUTHORITATIVE)) { console.error(`Missing authoritative locale ${AUTHORITATIVE}`); process.exit(1); }
  const namespaces = readdirSync(path.join(MESSAGES_DIR, AUTHORITATIVE)).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

  for (const namespace of namespaces) {
    let authoritativeTree: Tree;
    try {
      authoritativeTree = loadNamespace(AUTHORITATIVE, namespace)!;
    } catch (e) {
      errors.push(`${AUTHORITATIVE}/${namespace}.json: invalid JSON — ${(e as Error).message}`);
      continue;
    }
    const authFlat = flatten(authoritativeTree);

    for (const locale of locales) {
      if (locale === AUTHORITATIVE) continue;
      let tree: Tree | null;
      try {
        tree = loadNamespace(locale, namespace);
      } catch (e) {
        errors.push(`${locale}/${namespace}.json: invalid JSON — ${(e as Error).message}`);
        continue;
      }
      if (!tree) { errors.push(`${locale}/${namespace}.json: file missing`); continue; }

      const diff = diffNamespace(authoritativeTree, tree);
      for (const key of diff.missing) errors.push(`${locale}/${namespace}: missing key "${key}"`);
      for (const key of diff.extra) errors.push(`${locale}/${namespace}: unknown key "${key}" not in ${AUTHORITATIVE}`);
      for (const key of diff.empty) errors.push(`${locale}/${namespace}: empty translation for "${key}"`);
      for (const key of diff.placeholderMismatch) errors.push(`${locale}/${namespace}: placeholder mismatch for "${key}"`);

      const candFlat = flatten(tree);
      for (const key of Object.keys(authFlat)) {
        if (namespace !== 'enums' && candFlat[key] === authFlat[key] && authFlat[key].length > 12 && key !== 'appName') {
          warnings.push(`${locale}/${namespace}: "${key}" identical to English (possible untranslated)`);
        }
      }
    }
  }

  for (const w of warnings) console.warn(`⚠ ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`);
    console.error(`\ni18n:validate FAILED — ${errors.length} error(s), ${warnings.length} warning(s).`);
    process.exit(1);
  }
  console.log(`✓ i18n:validate passed — ${locales.length} locales, ${namespaces.length} namespaces, ${warnings.length} warning(s).`);
}

main();
