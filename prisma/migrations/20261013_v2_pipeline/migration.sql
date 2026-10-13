-- V2 pipeline / profile columns (run as table owner in Supabase SQL editor if db push fails)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "stage" TEXT NOT NULL DEFAULT 'new';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "stageChangedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "prevTier" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "prevScore" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "profile" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "scoreBreakdown" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "followUpAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");
CREATE INDEX IF NOT EXISTS "LeadActivity_createdAt_idx" ON "LeadActivity"("createdAt");

DO $$ BEGIN
  ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Workflow" ADD COLUMN IF NOT EXISTS "templateKey" TEXT;
ALTER TABLE "Workflow" ADD COLUMN IF NOT EXISTS "isTemplate" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Workflow_templateKey_idx" ON "Workflow"("templateKey");
