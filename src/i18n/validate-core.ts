/** Pure helpers behind `npm run i18n:validate`, extracted so they are unit-testable. */

export type Tree = { [k: string]: string | Tree };

export function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') Object.assign(out, flatten(value, full));
    else out[full] = String(value);
  }
  return out;
}

export function placeholders(value: string): Set<string> {
  return new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
}

export function eqSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

export interface NamespaceDiff {
  missing: string[];
  extra: string[];
  empty: string[];
  placeholderMismatch: string[];
}

/** Compares one candidate namespace tree against the authoritative (en-GB) tree. */
export function diffNamespace(authoritative: Tree, candidate: Tree): NamespaceDiff {
  const auth = flatten(authoritative);
  const cand = flatten(candidate);
  const diff: NamespaceDiff = { missing: [], extra: [], empty: [], placeholderMismatch: [] };
  for (const key of Object.keys(auth)) {
    if (!(key in cand)) { diff.missing.push(key); continue; }
    if (cand[key].trim() === '') diff.empty.push(key);
    if (!eqSet(placeholders(auth[key]), placeholders(cand[key]))) diff.placeholderMismatch.push(key);
  }
  for (const key of Object.keys(cand)) if (!(key in auth)) diff.extra.push(key);
  return diff;
}
