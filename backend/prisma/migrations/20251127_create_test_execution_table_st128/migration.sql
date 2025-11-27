-- CreateEnum for TestExecutionStatus
CREATE TYPE "TestExecutionStatus" AS ENUM ('pass', 'fail', 'skip', 'error');

-- CreateTable TestExecution
CREATE TABLE "TestExecution" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "test_case_id" UUID NOT NULL,
    "story_id" UUID,
    "commit_hash" TEXT,
    "executed_at" TIMESTAMPTZ NOT NULL,
    "status" "TestExecutionStatus" NOT NULL,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "coverage_percentage" DECIMAL(5,2),
    "lines_covered" INTEGER,
    "lines_total" INTEGER,
    "ci_run_id" TEXT,
    "environment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestExecution_test_case_id_idx" ON "TestExecution"("test_case_id");

-- CreateIndex
CREATE INDEX "TestExecution_story_id_idx" ON "TestExecution"("story_id");

-- CreateIndex
CREATE INDEX "TestExecution_status_idx" ON "TestExecution"("status");

-- CreateIndex
CREATE INDEX "TestExecution_executed_at_idx" ON "TestExecution"("executed_at");

-- AddForeignKey
ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (optional story relationship)
ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;
