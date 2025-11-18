-- CreateTable
CREATE TABLE "code_metrics_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_files" INTEGER NOT NULL,
    "total_loc" INTEGER NOT NULL,
    "avg_complexity" DOUBLE PRECISION NOT NULL,
    "avg_coverage" DOUBLE PRECISION NOT NULL,
    "health_score" DOUBLE PRECISION NOT NULL,
    "tech_debt_ratio" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "analysis_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_metrics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "code_metrics_snapshots_project_id_snapshot_date_idx" ON "code_metrics_snapshots"("project_id", "snapshot_date" DESC);

-- CreateIndex
CREATE INDEX "code_metrics_snapshots_project_id_created_at_idx" ON "code_metrics_snapshots"("project_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "code_metrics_snapshots_project_id_snapshot_date_key" ON "code_metrics_snapshots"("project_id", "snapshot_date");

-- AddForeignKey
ALTER TABLE "code_metrics_snapshots" ADD CONSTRAINT "code_metrics_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
