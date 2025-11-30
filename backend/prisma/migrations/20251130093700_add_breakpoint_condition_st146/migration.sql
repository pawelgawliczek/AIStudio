-- AlterTable
-- ST-146: Add conditional breakpoints and step mode support
ALTER TABLE "runner_breakpoints" ADD COLUMN     "condition" JSONB,
ADD COLUMN     "is_temporary" BOOLEAN NOT NULL DEFAULT false;
