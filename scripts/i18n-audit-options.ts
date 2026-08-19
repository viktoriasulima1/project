/**
 * Canonical <option> value audit (Part 15).  `npm run i18n:audit-options`
 *
 * Fails if any user-facing `<option>` lacks an explicit `value=` attribute. A
 * value-less option submits its (potentially translated) visible text as the
 * form value — the exact browser-translation defect found on the physical
 * iPhone. Every localized option must bind `value={canonicalToken}` and show a
 * separate localized label.
 *
 * Scope: src/app + src/components, excluding tests and dev-only diagnostics.
 * Put the marker `i18n-audit-ignore-option` in a JSX comment on the line above an
 * option to suppress it with a documented reason.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['src/app', 'src/components'];
const SKIP = ['__tests__', path.join('components', 'dev'), path.join('app', 'dev')];

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full, out); continue; }
    if (full.endsWith('.tsx')) out.push(full);
  }
}

function main() {
  const files: string[] = [];
  for (const root of ROOTS) {
    const abs = path.resolve(process.cwd(), root);
    try { walk(abs, files); } catch { /* root may not exist */ }
  }

  const violations: string[] = [];
  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    if (SKIP.some((s) => rel.includes(s))) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (index > 0 && lines[index - 1].includes('i18n-audit-ignore-option')) return;
      // Each opening <option ...> tag on this line
      for (const match of line.matchAll(/<option\b([^>]*)>/g)) {
        const attrs = match[1];
        if (!/\bvalue\s*=/.test(attrs)) {
          violations.push(`${rel}:${index + 1}  <option${attrs}>`);
        }
      }
    });
  }

  if (violations.length) {
    for (const v of violations) console.error(`✗ option without explicit value → ${v}`);
    console.error(`\ni18n:audit-options FAILED — ${violations.length} user-facing <option> without a value.`);
    process.exit(1);
  }
  console.log(`✓ i18n:audit-options passed — every user-facing <option> has an explicit canonical value.`);
}

main();
