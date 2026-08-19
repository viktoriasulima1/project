import 'server-only';
import { StructuredHttpAIProvider, UnavailableAIProvider, type AIProvider } from './provider';
import { deterministicBriefing } from './briefing';
import { parseActivityTextDeterministically } from './activity-parser';

class DeterministicTestAIProvider implements AIProvider {
  readonly name = 'deterministic-test';
  async generate<T>(request: Parameters<AIProvider['generate']>[0]): Promise<{ output: T }> {
    if (process.env.AI_TEST_PROVIDER_UNAVAILABLE === 'true') throw new Error('Test provider unavailable.');
    const input = request.input as { text?: string; facts?: unknown[] };
    const output = request.kind === 'daily_briefing'
      ? deterministicBriefing(request.input as Parameters<typeof deterministicBriefing>[0])
      : parseActivityTextDeterministically(input.text ?? '');
    return { output: request.validate(output) as T };
  }
}

export function configuredAIProvider(): AIProvider {
  if (process.env.AI_PROVIDER_MODE === 'deterministic_test') {
    if (process.env.NODE_ENV === 'production' && process.env.E2E_RUN !== 'true' && process.env.ALLOW_DETERMINISTIC_AI_IN_PRODUCTION !== 'true') return new UnavailableAIProvider();
    return new DeterministicTestAIProvider();
  }
  if (process.env.AI_API_KEY && /^(placeholder|change-me|test-key)$/i.test(process.env.AI_API_KEY)) return new UnavailableAIProvider();
  if (process.env.AI_DISABLED === 'true' || !process.env.AI_API_KEY || !process.env.AI_API_ENDPOINT) return new UnavailableAIProvider();
  return new StructuredHttpAIProvider({
    endpoint: process.env.AI_API_ENDPOINT,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL ?? 'small-structured-model',
    timeoutMs: Math.min(Number(process.env.AI_TIMEOUT_MS ?? 8000), 15000),
    maxOutputTokens: Math.min(Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 1200), 2000),
  });
}
