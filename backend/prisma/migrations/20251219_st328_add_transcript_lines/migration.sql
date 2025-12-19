-- ST-328: Add TranscriptLine model for incremental transcript storage
-- Enables streaming transcript storage line-by-line as agents execute

CREATE TABLE "transcript_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_run_id" UUID NOT NULL,
    "session_index" INTEGER NOT NULL,
    "line_number" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_lines_pkey" PRIMARY KEY ("id")
);

-- Create composite index for efficient queries
CREATE INDEX "transcript_lines_workflow_run_id_session_index_line_nu_idx" ON "transcript_lines"("workflow_run_id", "session_index", "line_number");

-- Add foreign key constraint
ALTER TABLE "transcript_lines" ADD CONSTRAINT "transcript_lines_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
