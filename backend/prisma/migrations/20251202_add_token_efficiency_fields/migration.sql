-- MCP Token Efficiency Optimization (ST-162)
-- Adds fields for token-efficient querying:
-- - story.summary: AI-generated 2-sentence summary
-- - artifact.content_preview: First 500 chars for metadata queries
-- - artifact.content_hash: SHA256 for change detection
-- - component_runs.output_summary: AI-generated summary of agent output

-- AlterTable: Add summary field to stories
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "summary" VARCHAR(300);

-- AlterTable: Add content preview and hash to artifacts
ALTER TABLE "artifacts" ADD COLUMN IF NOT EXISTS "content_preview" VARCHAR(500);
ALTER TABLE "artifacts" ADD COLUMN IF NOT EXISTS "content_hash" VARCHAR(64);

-- AlterTable: Add output summary to component_runs
ALTER TABLE "component_runs" ADD COLUMN IF NOT EXISTS "output_summary" VARCHAR(1000);
