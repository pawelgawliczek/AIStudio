-- ST-317: Epic Status Management - Simplify status enum
-- Change EpicStatus enum from planning/in_progress/done/archived to open/closed/cancelled

-- Step 1: Add new enum values temporarily
ALTER TYPE "EpicStatus" ADD VALUE IF NOT EXISTS 'open';
ALTER TYPE "EpicStatus" ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE "EpicStatus" ADD VALUE IF NOT EXISTS 'cancelled';

-- Step 2: Migrate existing data
-- planning/in_progress -> open
-- done/archived -> closed
UPDATE "epics" SET status = 'open' WHERE status IN ('planning', 'in_progress');
UPDATE "epics" SET status = 'closed' WHERE status IN ('done', 'archived');

-- Step 3: Create new enum type
CREATE TYPE "EpicStatus_new" AS ENUM ('open', 'closed', 'cancelled');

-- Step 4: Alter column to use new enum
ALTER TABLE "epics" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "epics" ALTER COLUMN "status" TYPE "EpicStatus_new" USING (status::text::"EpicStatus_new");
ALTER TABLE "epics" ALTER COLUMN "status" SET DEFAULT 'open'::"EpicStatus_new";

-- Step 5: Drop old enum and rename new one
DROP TYPE "EpicStatus";
ALTER TYPE "EpicStatus_new" RENAME TO "EpicStatus";
