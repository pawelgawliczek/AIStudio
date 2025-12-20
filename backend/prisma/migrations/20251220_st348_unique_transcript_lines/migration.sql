-- ST-348: Add unique constraint to transcript_lines table
-- This enables Prisma's skipDuplicates to actually prevent duplicate lines

-- First, remove any existing duplicates (keep the first one by id)
DELETE FROM transcript_lines t1
USING transcript_lines t2
WHERE t1.id > t2.id
  AND t1.workflow_run_id = t2.workflow_run_id
  AND t1.session_index = t2.session_index
  AND t1.line_number = t2.line_number;

-- Drop the existing non-unique index
DROP INDEX IF EXISTS "transcript_lines_workflow_run_id_session_index_line_number_idx";

-- Create unique constraint
CREATE UNIQUE INDEX "transcript_lines_workflow_run_id_session_index_line_number_key"
ON "transcript_lines"("workflow_run_id", "session_index", "line_number");
