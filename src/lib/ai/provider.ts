import { briefingOutputSchema, parsedActivityCandidateSchema, type BriefingOutput, type DailyFarmContext, type ParsedActivityCandidate } from './contracts';

export type AIRequestKind = 'daily_briefing' | 'activity_parse';

export interface AIProviderRequest<T> {
  kind: AIRequestKind;
  schemaVersion: string;
  input: unknown;
  validate: (value: unknown) => T;
}

export interface AIProvider {
  readonly name: string;
  generate<T>(request: AIProviderRequest<T>): Promise<{ output: T; inputTokens?: number; outputTokens?: number }>;
}

export class AIProviderUnavailableError extends Error {}

export class UnavailableAIProvider implements AIProvider {
  readonly name = 'unavailable';
  async generate<T>(): Promise<{ output: T }> {
    throw new AIProviderUnavailableError('AI provider is unavailable.');
  }
}

/** Vendor-neutral structured-output HTTP adapter. Keys remain server-only. */
export class StructuredHttpAIProvider implements AIProvider {
  readonly name: string;
  constructor(private readonly config: { endpoint: string; apiKey: string; model: string; timeoutMs: number; maxOutputTokens: number }) {
    this.name = `http:${config.model}`;
  }

  async generate<T>(request: AIProviderRequest<T>): Promise<{ output: T; inputTokens?: number; outputTokens?: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { authorization: `Bearer ${this.config.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, max_output_tokens: this.config.maxOutputTokens, request_type: request.kind, schema_version: request.schemaVersion, input: request.input }),
      });
      if (!response.ok) throw new AIProviderUnavailableError(`Provider returned ${response.status}.`);
      const body = await response.json() as { output?: unknown; usage?: { input_tokens?: number; output_tokens?: number } };
      return { output: request.validate(body.output), inputTokens: body.usage?.input_tokens, outputTokens: body.usage?.output_tokens };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function briefingRequest(context: DailyFarmContext): AIProviderRequest<BriefingOutput> {
  return { kind: 'daily_briefing', schemaVersion: 'briefing-v1', input: context, validate: (value) => briefingOutputSchema.parse(value) };
}

export function activityParseRequest(text: string): AIProviderRequest<ParsedActivityCandidate> {
  return { kind: 'activity_parse', schemaVersion: 'activity-parse-v1', input: { text }, validate: (value) => parsedActivityCandidateSchema.parse(value) };
}
