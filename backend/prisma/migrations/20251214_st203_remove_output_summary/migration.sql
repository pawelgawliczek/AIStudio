-- ST-203: Remove outputSummary field from component_runs
-- This field is being replaced by componentSummary (structured JSON format)

ALTER TABLE "component_runs" DROP COLUMN IF EXISTS "output_summary";
