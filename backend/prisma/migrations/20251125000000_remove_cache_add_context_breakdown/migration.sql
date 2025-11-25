-- ST-110: Replace cache metrics with /context token breakdown
-- Remove cache-related fields
ALTER TABLE "component_runs" DROP COLUMN IF EXISTS "tokens_cache_read";
ALTER TABLE "component_runs" DROP COLUMN IF EXISTS "tokens_cache_write";
ALTER TABLE "component_runs" DROP COLUMN IF EXISTS "cache_hits";
ALTER TABLE "component_runs" DROP COLUMN IF EXISTS "cache_misses";
ALTER TABLE "component_runs" DROP COLUMN IF EXISTS "cache_hit_rate";

-- Add token breakdown fields from /context command
ALTER TABLE "component_runs" ADD COLUMN "tokens_system_prompt" INTEGER DEFAULT 0;
ALTER TABLE "component_runs" ADD COLUMN "tokens_system_tools" INTEGER DEFAULT 0;
ALTER TABLE "component_runs" ADD COLUMN "tokens_mcp_tools" INTEGER DEFAULT 0;
ALTER TABLE "component_runs" ADD COLUMN "tokens_memory_files" INTEGER DEFAULT 0;
ALTER TABLE "component_runs" ADD COLUMN "tokens_messages" INTEGER DEFAULT 0;
