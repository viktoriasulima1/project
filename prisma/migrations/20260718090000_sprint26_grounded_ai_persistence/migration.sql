CREATE TYPE "AiBriefingMode" AS ENUM ('grounded_ai', 'rule_based_fallback');
CREATE TYPE "AiBriefingStatus" AS ENUM ('current', 'historical', 'stale');
CREATE TYPE "AiFeedbackType" AS ENUM ('helpful', 'not_useful', 'incorrect', 'already_knew');
CREATE TYPE "AiFeedbackReason" AS ENUM ('wrong_priority', 'wrong_explanation', 'stale_data', 'wrong_field', 'missing_context', 'other');
CREATE TYPE "AiRequestType" AS ENUM ('daily_briefing', 'activity_parse', 'voice_transcription');
CREATE TYPE "AiRequestResult" AS ENUM ('success', 'fallback', 'validation_failed', 'timeout', 'rate_limited', 'provider_unavailable');

CREATE TABLE "ai_briefings" (
  "id" TEXT NOT NULL, "farmId" TEXT NOT NULL, "generatedForDate" DATE NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "mode" "AiBriefingMode" NOT NULL,
  "contextChecksum" TEXT NOT NULL, "contextVersion" TEXT NOT NULL, "promptVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL, "provider" TEXT NOT NULL, "model" TEXT NOT NULL,
  "sourceDataTimestamp" TIMESTAMP(3) NOT NULL, "weatherFreshness" TEXT NOT NULL,
  "status" "AiBriefingStatus" NOT NULL DEFAULT 'current', "topItemsSnapshot" JSONB NOT NULL,
  "secondaryItemsSnapshot" JSONB NOT NULL, "whatChangedSnapshot" JSONB NOT NULL,
  "factsSnapshot" JSONB NOT NULL, "inputTokenCount" INTEGER, "outputTokenCount" INTEGER,
  "estimatedCostEur" DECIMAL(12,6), "durationMs" INTEGER NOT NULL, "fallbackReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ai_briefings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_briefings_farmId_generatedForDate_contextChecksum_key" ON "ai_briefings"("farmId", "generatedForDate", "contextChecksum");
CREATE INDEX "ai_briefings_farmId_generatedAt_idx" ON "ai_briefings"("farmId", "generatedAt" DESC);
CREATE INDEX "ai_briefings_farmId_generatedForDate_idx" ON "ai_briefings"("farmId", "generatedForDate");

CREATE TABLE "ai_briefing_feedback" (
  "id" TEXT NOT NULL, "farmId" TEXT NOT NULL, "briefingId" TEXT NOT NULL, "itemId" TEXT NOT NULL,
  "feedbackType" "AiFeedbackType" NOT NULL, "reason" "AiFeedbackReason", "comment" TEXT,
  "actorUserId" TEXT, "contextChecksum" TEXT NOT NULL, "promptVersion" TEXT NOT NULL,
  "model" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_briefing_feedback_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_briefing_feedback_briefingId_itemId_actorUserId_key" ON "ai_briefing_feedback"("briefingId", "itemId", "actorUserId");
CREATE INDEX "ai_briefing_feedback_farmId_createdAt_idx" ON "ai_briefing_feedback"("farmId", "createdAt" DESC);
CREATE INDEX "ai_briefing_feedback_briefingId_itemId_idx" ON "ai_briefing_feedback"("briefingId", "itemId");

CREATE TABLE "ai_request_metadata" (
  "id" TEXT NOT NULL, "farmId" TEXT NOT NULL, "briefingId" TEXT, "userReference" TEXT,
  "requestType" "AiRequestType" NOT NULL, "provider" TEXT NOT NULL, "model" TEXT NOT NULL,
  "contextChecksum" TEXT, "promptVersion" TEXT NOT NULL, "schemaVersion" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL, "completedAt" TIMESTAMP(3) NOT NULL, "durationMs" INTEGER NOT NULL,
  "inputTokenCount" INTEGER, "outputTokenCount" INTEGER, "estimatedCostEur" DECIMAL(12,6),
  "result" "AiRequestResult" NOT NULL, "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ai_request_metadata_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_request_metadata_farmId_requestType_createdAt_idx" ON "ai_request_metadata"("farmId", "requestType", "createdAt" DESC);
CREATE INDEX "ai_request_metadata_farmId_createdAt_idx" ON "ai_request_metadata"("farmId", "createdAt");
CREATE INDEX "ai_request_metadata_contextChecksum_idx" ON "ai_request_metadata"("contextChecksum");

ALTER TABLE "ai_briefings" ADD CONSTRAINT "ai_briefings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_briefing_feedback" ADD CONSTRAINT "ai_briefing_feedback_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_briefing_feedback" ADD CONSTRAINT "ai_briefing_feedback_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "ai_briefings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_request_metadata" ADD CONSTRAINT "ai_request_metadata_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_request_metadata" ADD CONSTRAINT "ai_request_metadata_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "ai_briefings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
