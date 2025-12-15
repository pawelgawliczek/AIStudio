-- ST-242: Add cache token columns to ComponentRun
-- These columns capture cache usage metrics from transcripts

ALTER TABLE "component_runs" ADD COLUMN IF NOT EXISTS "tokens_cache_creation" INTEGER DEFAULT 0;
ALTER TABLE "component_runs" ADD COLUMN IF NOT EXISTS "tokens_cache_read" INTEGER DEFAULT 0;
