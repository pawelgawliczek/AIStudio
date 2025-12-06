-- CreateTable
CREATE TABLE "unassigned_transcripts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "transcript_path" TEXT NOT NULL,
    "project_path" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cwd" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matched_at" TIMESTAMP(3),
    "workflow_run_id" UUID,

    CONSTRAINT "unassigned_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unassigned_transcripts_session_id_idx" ON "unassigned_transcripts"("session_id");

-- CreateIndex
CREATE INDEX "unassigned_transcripts_matched_at_idx" ON "unassigned_transcripts"("matched_at");

-- CreateIndex
CREATE INDEX "unassigned_transcripts_workflow_run_id_idx" ON "unassigned_transcripts"("workflow_run_id");

-- AddForeignKey
ALTER TABLE "unassigned_transcripts" ADD CONSTRAINT "unassigned_transcripts_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
