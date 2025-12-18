-- ST-317: Epic Status Management - Simplify status enum
-- Change EpicStatus enum from planning/in_progress/done/archived to open/closed/cancelled
--
-- PostgreSQL requires new enum values to be committed before use, so we use
-- the "create new enum, cast with CASE, swap" approach instead of ALTER TYPE ADD VALUE

-- Step 1: Create new enum type with desired values
CREATE TYPE "EpicStatus_new" AS ENUM ('open', 'closed', 'cancelled');

-- Step 2: Convert column to new enum with data migration via CASE expression
ALTER TABLE "epics" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "epics" ALTER COLUMN "status" TYPE "EpicStatus_new"
  USING (
    CASE status::text
      WHEN 'planning' THEN 'open'
      WHEN 'in_progress' THEN 'open'
      WHEN 'done' THEN 'closed'
      WHEN 'archived' THEN 'closed'
      ELSE 'open'  -- fallback for any unexpected values
    END
  )::"EpicStatus_new";
ALTER TABLE "epics" ALTER COLUMN "status" SET DEFAULT 'open'::"EpicStatus_new";

-- Step 3: Drop old enum and rename new one
DROP TYPE "EpicStatus";
ALTER TYPE "EpicStatus_new" RENAME TO "EpicStatus";
