export const APPROVED_SUPPRESSION_CATEGORIES = [
  'internal-diagnostic',
  'test-only',
  'external-verbatim',
  'canonical-token',
  'historical-compatibility',
] as const;

export type AuditSource = 'resolvers' | 'user-errors' | 'both';
export type Reachability =
  | 'ACTIVE_UI' | 'ACTIVE_SERVER_ACTION' | 'ACTIVE_API' | 'ACTIVE_DOMAIN'
  | 'ACTIVE_OFFLINE_SYNC' | 'ACTIVE_PROVIDER_BOUNDARY' | 'ACTIVE_EXPORT_REPORT'
  | 'LEGACY_COMPATIBILITY' | 'INTERNAL_DIAGNOSTIC' | 'DEVELOPMENT_ONLY'
  | 'TEST_ONLY' | 'FIXTURE_ONLY' | 'DEAD_OR_UNREACHABLE' | 'DOCUMENTATION_ONLY'
  | 'UNKNOWN_REQUIRES_REVIEW';

export interface StructuredAuditFinding {
  file: string;
  line: number;
  column: number | null;
  matchedText: string;
  findingType: string;
  enclosingFunctionOrExport: string | null;
  probableModule: string;
  productionClassification: 'production' | 'internal' | 'test' | 'development' | 'legacy' | 'unknown';
  reachability: Reachability;
  userVisibleTarget: boolean;
  contractFamily: string;
  suppressionState: 'none' | `approved:${typeof APPROVED_SUPPRESSION_CATEGORIES[number]}` | 'invalid';
  sourceAudit: AuditSource;
}

export function suppressionCategory(line: string): typeof APPROVED_SUPPRESSION_CATEGORIES[number] | 'invalid' | null {
  if (!line.includes('i18n-audit-ignore')) return null;
  const value = line.match(/i18n-audit-ignore:\s*([a-z-]+)/)?.[1];
  return APPROVED_SUPPRESSION_CATEGORIES.includes(value as typeof APPROVED_SUPPRESSION_CATEGORIES[number])
    ? value as typeof APPROVED_SUPPRESSION_CATEGORIES[number]
    : 'invalid';
}

export function probableModule(file: string): string {
  const p = file.replace(/\\/g, '/').toLowerCase();
  const mappings: Array<[RegExp, string]> = [
    [/scouting.*(photo|storage)|photo-/, 'Scouting photo/storage'],
    [/scouting/, 'Scouting'], [/offline/, 'Offline Sync Center'],
    [/field-operations|work-order|operations/, 'Work Orders / Planning'],
    [/activit|quick-log/, 'Activities / Quick Log'],
    [/inventory/, 'Inventory'], [/brp/, 'BRP import'], [/fields?/, 'Fields'],
    [/reallocation|allocation/, 'Allocations'], [/economics|finance/, 'Finance'],
    [/compliance|correction|reversal/, 'Compliance'], [/export|report/, 'Reports / exports'],
    [/weather|spray-window/, 'Weather'], [/briefing|\bai\b|transcri/, 'Daily Briefing / AI'],
    [/auth|clerk|farm\.ts|user-error/, 'Authentication / shared errors'],
    [/dashboard|farm-insight/, 'Dashboard / Farm Insights'], [/onboarding/, 'Onboarding'],
  ];
  return mappings.find(([pattern]) => pattern.test(p))?.[1] ?? 'Shared domain utilities';
}

export function classifyReachability(file: string, description: string): Reachability {
  const p = file.replace(/\\/g, '/').toLowerCase();
  if (p.includes('__tests__') || /\.test\.|\.spec\./.test(p)) return 'TEST_ONLY';
  if (p.includes('/fixtures/') || p.includes('/seed') || p.includes('/mock-data/')) return 'FIXTURE_ONLY';
  if (p.includes('/dev/') || p.includes('dev-demo') || p.includes('pilot-environment') || p.includes('instrumentation')) return 'DEVELOPMENT_ONLY';
  if (p.includes('legacy') || /historical|persisted prose/i.test(description)) return 'LEGACY_COMPATIBILITY';
  if (p.includes('src/components/')) return 'ACTIVE_UI';
  if (p.includes('src/app/api/')) return 'ACTIVE_API';
  if (p.includes('src/offline/') || p.includes('offline-sync')) return 'ACTIVE_OFFLINE_SYNC';
  if (p.includes('src/lib/actions/')) return 'ACTIVE_SERVER_ACTION';
  if (/config|audit\.ts|product-events|pilot-/.test(p) && /refusing|required|configured|unsupported/i.test(description)) return 'INTERNAL_DIAGNOSTIC';
  if (/storage|provider|weather\.ts|transcription/.test(p)) return 'ACTIVE_PROVIDER_BOUNDARY';
  if (/export|report/.test(p)) return 'ACTIVE_EXPORT_REPORT';
  if (p.includes('src/lib/')) return 'ACTIVE_DOMAIN';
  return 'UNKNOWN_REQUIRES_REVIEW';
}

export function contractFamily(file: string, description: string): string {
  const text = `${file} ${description}`.toLowerCase();
  if (/error\.message|string\(error\)|framework\/caught/.test(text)) return 'raw technical forwarding';
  if (/offline|sync|draft|indexeddb/.test(text)) return 'offline/sync errors';
  if (/photo|mime|upload|storage|annotation/.test(text)) return 'photo/storage errors';
  if (/work order|work-order|transition|completed/.test(text)) return 'Work Order conflicts';
  if (/stock|inventory/.test(text)) return 'inventory/stock errors';
  if (/allocation|reallocat/.test(text)) return 'allocation errors';
  if (/correction|reversal|reversed/.test(text)) return 'correction/reversal errors';
  if (/provider|weather|transcri|\bai\b/.test(text)) return 'provider errors';
  if (/export|report/.test(text)) return 'report/export errors';
  if (/not found|does not belong|access|permission/.test(text)) return 'not-found/security errors';
  if (/duplicate|already|conflict|stale|version/.test(text)) return 'conflict/idempotency errors';
  if (/valid|required|invalid|must|cannot|exceed|range/.test(text)) return 'validation errors';
  return 'generic/status prose';
}

export function enclosingSymbol(source: string, line: number): string | null {
  const lines = source.split('\n');
  for (let index = Math.min(line - 1, lines.length - 1); index >= 0; index--) {
    const raw = lines[index];
    const match = raw.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?const\s+(\w+)\s*=|class\s+(\w+)/);
    if (match) return match[1] ?? match[2] ?? match[3] ?? null;
  }
  return null;
}

export function redactMatchedText(value: string): string {
  return value
    .replace(/(bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/((?:secret|token|password|cookie|authorization)\s*[:=]\s*)[^\s,"']+/gi, '$1[REDACTED]')
    .slice(0, 240);
}

export function structuredFinding(raw: string, sourceAudit: Exclude<AuditSource, 'both'>, sources: Map<string, string>): StructuredAuditFinding {
  const match = raw.match(/^(.*?):(\d+)\s+(.*)$/);
  const file = (match?.[1] ?? 'unknown').replace(/\\/g, '/');
  const line = Number(match?.[2] ?? 0);
  const description = match?.[3]?.trim() ?? raw.trim();
  const reachability = classifyReachability(file, description);
  const internal = ['INTERNAL_DIAGNOSTIC', 'DEVELOPMENT_ONLY', 'TEST_ONLY', 'FIXTURE_ONLY', 'DOCUMENTATION_ONLY', 'DEAD_OR_UNREACHABLE'].includes(reachability);
  return {
    file, line, column: null, matchedText: redactMatchedText(description),
    findingType: description.includes('raw ') ? 'raw-error-forwarding' : description.includes('exported label') ? 'exported-label-map' : description.split(':')[0],
    enclosingFunctionOrExport: enclosingSymbol(sources.get(file) ?? '', line),
    probableModule: probableModule(file),
    productionClassification: reachability === 'TEST_ONLY' || reachability === 'FIXTURE_ONLY' ? 'test' : reachability === 'DEVELOPMENT_ONLY' ? 'development' : reachability === 'LEGACY_COMPATIBILITY' ? 'legacy' : internal ? 'internal' : reachability === 'UNKNOWN_REQUIRES_REVIEW' ? 'unknown' : 'production',
    reachability,
    userVisibleTarget: !internal && reachability !== 'LEGACY_COMPATIBILITY' && reachability !== 'UNKNOWN_REQUIRES_REVIEW',
    contractFamily: contractFamily(file, description), suppressionState: 'none', sourceAudit,
  };
}

export function safeJson(findings: StructuredAuditFinding[], generatedAt = new Date().toISOString()): string {
  const sorted = [...findings].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.matchedText.localeCompare(b.matchedText));
  return `${JSON.stringify({ schemaVersion: 1, generatedAt, findingCount: sorted.length, findings: sorted }, null, 2)}\n`;
}
