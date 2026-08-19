/**
 * Broad hard-coded farmer-facing string audit (Part 3).
 *   npm run i18n:audit                 (whole app)
 *   npm run i18n:audit -- scouting     (only paths containing "scouting")
 *
 * Heuristic scanner for user-facing English that should go through the
 * translator. It flags:
 *   - JSX text nodes containing a real word (after stripping {expressions})
 *   - hardcoded label-like attributes: placeholder / aria-label / title / alt
 *   - user-facing <option> without an explicit value (delegates to the same rule
 *     as i18n:audit-options)
 *
 * Suppress a genuine exception (farmer-entered text, field/farm/product name,
 * UUID, Ctgb, BRP, BBCH, registration number, external attribution, dev-only
 * diagnostics) with `i18n-audit-ignore` in a comment on or above the line.
 *
 * Scope: src/app + src/components, excluding __tests__ and dev-only diagnostics.
 * Exits non-zero if the scanned scope has any unexplained string, so it can gate
 * a module once that module is localized.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { safeJson, structuredFinding, suppressionCategory } from './i18n-audit-json';

const ROOTS = ['src/app', 'src/components'];
const SKIP = ['__tests__', path.join('components', 'dev'), path.join('app', 'dev')];
const LABEL_ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

const moduleFilter = process.argv.slice(2).find((a) => !a.startsWith('-'));
// `npm run i18n:audit -- resolvers` scans the PURE DOMAIN layer (src/lib) for
// final English prose (explanations/reasons/labels) that pure resolvers must not
// return — the known audit blind spot. Different scope + rules from module mode.
const RESOLVER_MODE = moduleFilter === 'resolvers';
const USER_ERROR_MODE = moduleFilter === 'user-errors';
const JSON_MODE = process.argv.includes('--json');
const OUTPUT_PATH = process.argv.find((value) => value.startsWith('--output='))?.slice('--output='.length);
const USER_ERROR_ROOTS = ['src/lib/user-error.ts', 'src/lib/actions', 'src/app/api', 'src/offline', 'src/components'];

function walkTs(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) { walkTs(full, out); continue; }
    if (full.endsWith('.ts') && !full.endsWith('.d.ts')) out.push(full);
  }
}

function walkCode(dir: string, out: string[]) {
  if (statSync(dir).isFile()) { out.push(dir); return; }
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) { walkCode(full, out); continue; }
    if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
  }
}

function findUserErrorViolations(rel: string, source: string): string[] {
  const found: string[] = [];
  const lines = source.split('\n');
  lines.forEach((raw, index) => {
    const suppression = suppressionCategory(raw) ?? (index > 0 ? suppressionCategory(lines[index - 1]) : null);
    if (suppression === 'invalid') { found.push(`${rel}:${index + 1} undocumented suppression category`); return; }
    if (suppression) return;
    const normalized = raw.replace(/\s+/g, ' ');
    if (/error\s+instanceof\s+Error\s*\?\s*error\.message|\bString\(error\)|\.issues\[0\]\?\.message|flatten\(\)\.fieldErrors/.test(normalized)) {
      found.push(`${rel}:${index + 1} raw framework/caught error forwarding`);
    }
    if (/return\s+(?:NextResponse\.json\()?\s*\{[^}]*\berror\s*:\s*['"][A-Z][^'"]*[ .'!?][^'"]*['"]/.test(normalized)) {
      found.push(`${rel}:${index + 1} final English error response`);
    }
    if (/set(?:Error|Message|Feedback|AiError)\([^)]*error\.message|toast\([^)]*error\.message/.test(normalized)) {
      found.push(`${rel}:${index + 1} raw caught error rendered by UI`);
    }
  });
  return [...new Set(found)];
}

/** Prose-field keys a domain resolver must not carry final English text on. */
const PROSE_KEYS = ['explanation', 'recommendedAction', 'recommendation', 'reason', 'message', 'title', 'note', 'summary'];

/** Heuristic: a value that reads like a user-facing English sentence/phrase. */
function looksLikeProse(value: string): boolean {
  const v = value.trim();
  if (v.length < 8) return false;
  if (v.includes('/') || v.includes('@') || v.includes('.ts') || v.includes('${') || v.includes('_')) return false; // paths/templates/tokens
  if (!/\s/.test(v)) return false; // single token = canonical, not prose
  if (!/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(v)) return false; // needs ≥2 real words
  return /^[A-Z]/.test(v) || /[.?!]"?$/.test(v); // capitalised or sentence-punctuated
}

function findResolverViolations(rel: string, source: string): string[] {
  const found: string[] = [];
  const lines = source.split('\n');
  lines.forEach((raw, index) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return; // comment
    const suppression = suppressionCategory(raw) ?? (index > 0 ? suppressionCategory(lines[index - 1]) : null);
    if (suppression === 'invalid') { found.push(`${rel}:${index + 1} undocumented suppression category`); return; }
    if (suppression) return;

    // A) exported English label maps (should become enum namespaces)
    if (/export const \w*(_LABEL|_LABELS|Labels?)\b/.test(raw)) found.push(`${rel}:${index + 1}  exported label map (localize via enums/adapter)`);

    // B) prose-field object properties: explanation: 'English sentence'
    for (const key of PROSE_KEYS) {
      const re = new RegExp(`\\b${key}\\s*:\\s*(['"\\\`])([^'"\\\`]+)\\1`, 'g');
      for (const m of raw.matchAll(re)) if (looksLikeProse(m[2])) found.push(`${rel}:${index + 1}  ${key}: "${m[2].slice(0, 50)}"`);
    }

    // C) any bare English-sentence string literal (catches prose passed positionally)
    for (const m of raw.matchAll(/(['"])([^'"]{8,})\1/g)) {
      if (looksLikeProse(m[2])) found.push(`${rel}:${index + 1}  prose "${m[2].slice(0, 50)}"`);
    }
  });
  // de-dupe identical file:line:text
  return [...new Set(found)];
}

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full, out); continue; }
    if (full.endsWith('.tsx')) out.push(full);
  }
}

/** Removes {…expressions…} (translator calls, dynamic values) iteratively. */
function stripExpressions(line: string): string {
  let prev: string;
  let out = line;
  do { prev = out; out = out.replace(/\{[^{}]*\}/g, ''); } while (out !== prev);
  return out;
}

const hasWord = (text: string) => /[A-Za-z]{2,}/.test(text);

function findViolations(rel: string, source: string): string[] {
  const found: string[] = [];
  const lines = source.split('\n');
  lines.forEach((raw, index) => {
    const suppression = suppressionCategory(raw) ?? (index > 0 ? suppressionCategory(lines[index - 1]) : null);
    if (suppression === 'invalid') { found.push(`${rel}:${index + 1} undocumented suppression category`); return; }
    if (suppression) return;

    // A) label-like attributes with string literals
    for (const attr of LABEL_ATTRS) {
      const re = new RegExp(`${attr}\\s*=\\s*(["'])(.*?)\\1`, 'g');
      for (const m of raw.matchAll(re)) if (hasWord(m[2])) found.push(`${rel}:${index + 1}  ${attr}="${m[2]}"`);
    }

    // B) value-less <option>
    for (const m of raw.matchAll(/<option\b([^>]*)>/g)) {
      if (!/\bvalue\s*=/.test(m[1])) found.push(`${rel}:${index + 1}  <option> without value`);
    }

    // C) JSX text nodes (after removing expressions)
    const stripped = stripExpressions(raw);
    for (const m of stripped.matchAll(/>([^<>]+)</g)) {
      const text = m[1].trim();
      if (hasWord(text)) found.push(`${rel}:${index + 1}  JSX text "${text.slice(0, 60)}"`);
    }
  });
  return found;
}

function main() {
  const files: string[] = [];
  if (USER_ERROR_MODE) {
    for (const root of USER_ERROR_ROOTS) try { walkCode(path.resolve(process.cwd(), root), files); } catch { /* missing */ }
  } else if (RESOLVER_MODE) {
    try { walkTs(path.resolve(process.cwd(), 'src/lib'), files); } catch { /* missing */ }
  } else {
    for (const root of ROOTS) {
      try { walk(path.resolve(process.cwd(), root), files); } catch { /* missing root */ }
    }
  }

  let scanned = 0;
  const violations: string[] = [];
  const sources = new Map<string, string>();
  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    if (SKIP.some((s) => rel.includes(s))) continue;
    if (!RESOLVER_MODE && !USER_ERROR_MODE && moduleFilter && !rel.toLowerCase().includes(moduleFilter.toLowerCase())) continue;
    scanned++;
    const source = readFileSync(file, 'utf8');
    sources.set(rel.replace(/\\/g, '/'), source);
    violations.push(...(USER_ERROR_MODE ? findUserErrorViolations(rel, source) : RESOLVER_MODE ? findResolverViolations(rel, source) : findViolations(rel, source)));
  }

  const scope = USER_ERROR_MODE ? 'active user-error paths' : RESOLVER_MODE ? 'domain resolvers (src/lib)' : moduleFilter ? `module "${moduleFilter}"` : 'all farmer-facing files';
  if ((RESOLVER_MODE || USER_ERROR_MODE) && (JSON_MODE || OUTPUT_PATH)) {
    const json = safeJson(violations.map((value) => structuredFinding(value, USER_ERROR_MODE ? 'user-errors' : 'resolvers', sources)));
    if (OUTPUT_PATH) {
      const target = path.resolve(process.cwd(), OUTPUT_PATH);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, json, 'utf8');
    }
    if (JSON_MODE && !OUTPUT_PATH) process.stdout.write(json);
  }
  if (violations.length) {
    for (const v of violations) console.error(`✗ ${v}`);
    console.error(`\ni18n:audit — ${violations.length} unexplained string(s) in ${scope} (${scanned} files).`);
    process.exit(1);
  }
  console.log(`✓ i18n:audit passed — no unexplained farmer-facing strings in ${scope} (${scanned} files).`);
}

main();
