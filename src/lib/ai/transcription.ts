export const TRANSCRIPTION_MIME_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']);
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_DURATION_SECONDS = 60;
export type TranscriptionErrorCategory = 'unsupported_mime' | 'too_large' | 'timeout' | 'rate_limited' | 'provider_unavailable' | 'invalid_response';

export function validateAudioContract(input: { mimeType: string; byteSize: number; durationSeconds: number }) {
  if (!TRANSCRIPTION_MIME_TYPES.has(input.mimeType)) return { ok: false as const, category: 'unsupported_mime' as const };
  if (input.byteSize > MAX_AUDIO_BYTES || input.durationSeconds > MAX_AUDIO_DURATION_SECONDS) return { ok: false as const, category: 'too_large' as const };
  return { ok: true as const };
}

export interface TranscriptionProvider { name: string; transcribe(input: { bytes: Uint8Array; mimeType: string; signal: AbortSignal }): Promise<string> }
export class UnavailableTranscriptionProvider implements TranscriptionProvider { name = 'unavailable'; async transcribe(): Promise<string> { throw new Error('provider_unavailable'); } }
export class DeterministicTestTranscriber implements TranscriptionProvider { name = 'deterministic-test'; async transcribe(): Promise<string> { return 'Scouted field North over 3 hectares.'; } }
export class HttpTranscriptionProvider implements TranscriptionProvider {
  name: string; constructor(private config: { endpoint: string; key: string; model: string }) { this.name = `http:${config.model}`; }
  async transcribe(input: { bytes: Uint8Array; mimeType: string; signal: AbortSignal }) {
    const response = await fetch(this.config.endpoint, { method: 'POST', signal: input.signal, headers: { authorization: `Bearer ${this.config.key}`, 'content-type': input.mimeType, 'x-model': this.config.model }, body: new Blob([input.bytes as BlobPart], { type: input.mimeType }) });
    if (!response.ok) throw new Error(response.status === 401 ? 'provider_unavailable' : response.status === 429 ? 'rate_limited' : 'provider_unavailable');
    const body = await response.json() as { transcript?: unknown }; if (typeof body.transcript !== 'string' || !body.transcript.trim()) throw new Error('invalid_response');
    return body.transcript.slice(0, 2000);
  }
}
export function configuredTranscriber(): TranscriptionProvider {
  if (process.env.AI_PROVIDER_MODE === 'deterministic_test' && (process.env.NODE_ENV !== 'production' || process.env.E2E_RUN === 'true')) return new DeterministicTestTranscriber();
  if (!process.env.AI_TRANSCRIPTION_ENDPOINT || !process.env.AI_API_KEY) return new UnavailableTranscriptionProvider();
  return new HttpTranscriptionProvider({ endpoint: process.env.AI_TRANSCRIPTION_ENDPOINT, key: process.env.AI_API_KEY, model: process.env.AI_TRANSCRIPTION_MODEL ?? 'small-transcription-model' });
}
