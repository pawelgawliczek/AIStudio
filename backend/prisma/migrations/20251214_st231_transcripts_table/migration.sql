-- CreateEnum
CREATE TYPE "transcript_type" AS ENUM ('MASTER', 'AGENT');

-- CreateTable
CREATE TABLE "transcripts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "type" "transcript_type" NOT NULL,
    "session_id" TEXT,
    "agent_id" TEXT,
    "workflow_run_id" UUID,
    "component_run_id" UUID,
    "content" TEXT NOT NULL,
    "content_size" INTEGER,
    "metrics" JSONB,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transcripts_session_id_idx" ON "transcripts"("session_id");

-- CreateIndex
CREATE INDEX "transcripts_workflow_run_id_idx" ON "transcripts"("workflow_run_id");

-- CreateIndex
CREATE INDEX "transcripts_component_run_id_idx" ON "transcripts"("component_run_id");

-- CreateIndex
CREATE INDEX "transcripts_type_idx" ON "transcripts"("type");

-- CreateIndex
CREATE INDEX "transcripts_uploaded_at_idx" ON "transcripts"("uploaded_at");

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_component_run_id_fkey" FOREIGN KEY ("component_run_id") REFERENCES "component_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
