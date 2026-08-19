/**
 * Small, pure guards used to make interactive client state provably bounded.
 *
 * The physical-iPhone test surfaced a "Maximum call stack size exceeded"
 * runtime crash while an external agent (browser page-translation) was mutating
 * the DOM. External DOM mutation cannot be prevented, but the application must
 * never turn a stray event into an unbounded update/recursion loop. These
 * helpers give the components a common, tested way to:
 *   - ignore a state write that would not change anything (breaks setState loops)
 *   - traverse arbitrary objects for diagnostics without infinite recursion
 *   - keep a two-state (open/close) toggle idempotent
 */

/** Shallow structural equality for plain records/arrays/primitives (one level). */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => Object.is(v, b[i]));
  }
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Returns `next` only when it differs from `prev`; otherwise returns `prev`
 * (the SAME reference), so `setState(guardedUpdate(prev, next))` is a no-op and
 * cannot feed an effect that watches that state. Idempotent by construction.
 */
export function guardedUpdate<T>(prev: T, next: T): T {
  return shallowEqual(prev, next) ? prev : next;
}

export type ToggleAction = 'open' | 'close' | 'toggle';

/** Bounded open/close transition — never oscillates, always resolves to a bool. */
export function nextVisibility(current: boolean, action: ToggleAction): boolean {
  switch (action) {
    case 'open':
      return true;
    case 'close':
      return false;
    case 'toggle':
      return !current;
    default:
      return current;
  }
}

/**
 * Depth- and cycle-safe serialization for diagnostic context. Replaces cyclic
 * references with '[Circular]' and caps depth so a self-referential object can
 * never overflow the stack. Non-JSON values are stringified defensively.
 */
export function safeSerialize(value: unknown, maxDepth = 6): unknown {
  const seen = new WeakSet<object>();
  const walk = (node: unknown, depth: number): unknown => {
    if (node === null || typeof node !== 'object') {
      if (typeof node === 'bigint') return `${node}n`;
      if (typeof node === 'function') return '[Function]';
      if (typeof node === 'undefined') return undefined;
      return node;
    }
    if (seen.has(node as object)) return '[Circular]';
    if (depth >= maxDepth) return '[MaxDepth]';
    seen.add(node as object);
    try {
      if (Array.isArray(node)) return node.map((item) => walk(item, depth + 1));
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        out[key] = walk(val, depth + 1);
      }
      return out;
    } finally {
      // Allow the same object to appear on sibling branches (DAG), only reject
      // true cycles on the current path.
      seen.delete(node as object);
    }
  };
  return walk(value, 0);
}
