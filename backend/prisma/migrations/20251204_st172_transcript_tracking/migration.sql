-- ST-172: Hook-based transcript tracking
-- Add columns for storing master session transcripts and spawned agent transcripts

-- AlterTable
ALTER TABLE "workflow_runs" ADD COLUMN IF NOT EXISTS "master_transcript_paths" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "workflow_runs" ADD COLUMN IF NOT EXISTS "spawned_agent_transcripts" JSONB;
