import type { OfflineActivityType } from '@/offline/types';

export interface SplitActivityCandidate { index: number; originalTextSpan: string; activityType: OfflineActivityType | null; fieldText: string | null; productText: string | null; unresolvedFields: string[] }
export interface MultiActivityDetection { classification: 'single_activity' | 'multiple_activities' | 'ambiguous'; candidates: SplitActivityCandidate[]; truncated: boolean }
const OPERATION = /\b(sprayed|spray|fertilised|fertilized|harvested|scouted|gespoten|bemest|geoogst)\b/gi;
const typeOf = (word: string): OfflineActivityType | null => /spray|spra|gespoten/i.test(word) ? 'spray' : /fert|bemest/i.test(word) ? 'fertilise' : /harvest|geoogst/i.test(word) ? 'harvest' : /scout/i.test(word) ? 'scout' : null;

export function detectMultipleActivities(text: string): MultiActivityDetection {
  const matches = [...text.matchAll(OPERATION)];
  const fieldMentions = [...text.matchAll(/(?:field|perceel)\s+([\p{L}\d][\p{L}\d _-]*?)(?=\s+(?:with|met|and|en|then)|[,.]|$)/giu)];
  if (matches.length === 1 && fieldMentions.length > 1) {
    return { classification: 'multiple_activities', candidates: fieldMentions.slice(0, 5).map((field, index) => ({ index, originalTextSpan: `${matches[0][0]} field ${field[1].trim()}`, activityType: typeOf(matches[0][0]), fieldText: field[1].trim(), productText: null, unresolvedFields: [] })), truncated: fieldMentions.length > 5 };
  }
  if (matches.length <= 1) return { classification: /\band\b|\ben\b/i.test(text) ? 'ambiguous' : 'single_activity', candidates: matches.map((match, index) => candidate(index, text, match[0])), truncated: false };
  const spans = matches.slice(0, 5).map((match, index) => {
    const start = match.index ?? 0; const end = matches[index + 1]?.index ?? text.length;
    return candidate(index, text.slice(start, end).replace(/^[,;\s]+|[,;\s]+$/g, ''), match[0]);
  });
  return { classification: 'multiple_activities', candidates: spans, truncated: matches.length > 5 };
}

function candidate(index: number, span: string, operation: string): SplitActivityCandidate {
  const field = /(?:field|perceel)\s+([\p{L}\d][\p{L}\d _-]*?)(?=\s+(?:with|met|and|en|then)|[,.]|$)/iu.exec(span)?.[1]?.trim() ?? null;
  const product = /(?:with|met)\s+([\p{L}\d][\p{L}\d _-]*?)(?=[,.]|\s+(?:at|op|and|en|then)|$)/iu.exec(span)?.[1]?.trim() ?? null;
  return { index, originalTextSpan: span, activityType: typeOf(operation), fieldText: field, productText: product, unresolvedFields: [...(!field ? ['field'] : []), ...(!typeOf(operation) ? ['activityType'] : [])] };
}
