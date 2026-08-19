import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { configuredTranscriber, validateAudioContract } from '@/lib/ai/transcription';

export async function POST(request: Request) {
  const startedAt = new Date(); const farm = await getActiveFarmOrThrow(); const actor = await getClerkUserId() ?? farm.clerkUserId;
  const form = await request.formData(); const audio = form.get('audio'); const durationSeconds = Number(form.get('durationSeconds') ?? 0);
  if (!(audio instanceof File)) return NextResponse.json({ error: 'No audio supplied.', category: 'invalid_response' }, { status: 400 });
  const validation = validateAudioContract({ mimeType: audio.type, byteSize: audio.size, durationSeconds });
  if (!validation.ok) return NextResponse.json({ error: 'Audio format or size is not supported.', category: validation.category }, { status: 400 });
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (await db.aiRequestMetadata.count({ where: { farmId: farm.id, userReference: actor, requestType: 'voice_transcription', createdAt: { gte: today } } }) >= 20) return NextResponse.json({ error: 'Daily transcription limit reached.', category: 'rate_limited' }, { status: 429 });
  const provider = configuredTranscriber(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12_000);
  let result: 'success' | 'timeout' | 'provider_unavailable' | 'validation_failed' = 'success';
  try {
    // Bytes exist only in this request scope and are never written to DB/logs.
    const transcript = await provider.transcribe({ bytes: new Uint8Array(await audio.arrayBuffer()), mimeType: audio.type, signal: controller.signal });
    return NextResponse.json({ transcript });
  } catch (error) {
    result = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'provider_unavailable';
    return NextResponse.json({ error: 'Voice transcription is unavailable. You can type or edit the description.', category: result }, { status: 503 });
  } finally {
    clearTimeout(timer); const ended = new Date(); await db.aiRequestMetadata.create({ data: { farmId: farm.id, userReference: actor, requestType: 'voice_transcription', provider: provider.name, model: process.env.AI_TRANSCRIPTION_MODEL ?? provider.name, promptVersion: 'voice-v1', schemaVersion: 'transcript-v1', startedAt, completedAt: ended, durationMs: ended.getTime() - startedAt.getTime(), result } });
  }
}
