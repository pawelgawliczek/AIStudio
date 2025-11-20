-- ST-54: Disk Space Monitoring & Alerts
-- Create tables and enums for disk usage tracking and alerting

-- CreateEnum: AlertType (only if it doesn't exist)
DO $$ BEGIN
    CREATE TYPE "AlertType" AS ENUM ('warning', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: disk_usage_alerts
CREATE TABLE "disk_usage_alerts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alert_type" "AlertType" NOT NULL,
    "threshold_gb" INTEGER NOT NULL,
    "available_space_gb" DECIMAL(10,2) NOT NULL,
    "used_space_gb" DECIMAL(10,2) NOT NULL,
    "total_space_gb" DECIMAL(10,2) NOT NULL,
    "percent_used" DECIMAL(5,2) NOT NULL,
    "worktree_count" INTEGER NOT NULL,
    "stalled_count" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "disk_usage_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: disk_usage_reports
CREATE TABLE "disk_usage_reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "report_date" TIMESTAMP(3) NOT NULL,
    "report_period_start" TIMESTAMP(3) NOT NULL,
    "report_period_end" TIMESTAMP(3) NOT NULL,
    "total_space_gb" DECIMAL(10,2) NOT NULL,
    "used_space_gb" DECIMAL(10,2) NOT NULL,
    "available_space_gb" DECIMAL(10,2) NOT NULL,
    "percent_used" DECIMAL(5,2) NOT NULL,
    "total_worktrees" INTEGER NOT NULL,
    "active_worktrees" INTEGER NOT NULL,
    "stalled_worktrees" INTEGER NOT NULL,
    "total_worktree_usage_mb" INTEGER NOT NULL,
    "avg_worktree_usage_mb" DECIMAL(10,2) NOT NULL,
    "largest_worktrees" JSONB,
    "stalled_worktrees_list" JSONB,
    "week_over_week_change_gb" DECIMAL(10,2),
    "week_over_week_change_percent" DECIMAL(5,2),
    "report_html" TEXT,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at" TIMESTAMP(3),

    CONSTRAINT "disk_usage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: disk_usage_alerts indexes
CREATE INDEX "disk_usage_alerts_created_at_idx" ON "disk_usage_alerts"("created_at" DESC);
CREATE INDEX "disk_usage_alerts_alert_type_created_at_idx" ON "disk_usage_alerts"("alert_type", "created_at");

-- CreateIndex: disk_usage_reports indexes
CREATE INDEX "disk_usage_reports_report_date_idx" ON "disk_usage_reports"("report_date" DESC);
CREATE INDEX "disk_usage_reports_created_at_idx" ON "disk_usage_reports"("created_at" DESC);

-- CreateIndex: Add index on worktrees for stale detection
CREATE INDEX "worktrees_status_updated_at_idx" ON "worktrees"("status", "updated_at");
