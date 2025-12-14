-- ST-214: Story-Scoped Artifacts with Version History
-- Transform artifacts from workflow-run-scoped to story-scoped with version history

-- Step 1: Create ArtifactVersion table
CREATE TABLE "artifact_versions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "artifact_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "workflow_run_id" UUID,
    "content" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "content_type" VARCHAR(255) NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "created_by_component_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_versions_pkey" PRIMARY KEY ("id")
);

-- Step 2: Add new columns to artifacts table
ALTER TABLE "artifacts" ADD COLUMN "story_id" UUID;
ALTER TABLE "artifacts" ADD COLUMN "last_updated_run_id" UUID;
ALTER TABLE "artifacts" RENAME COLUMN "version" TO "current_version";

-- Step 3: Populate story_id from workflow_run_id (data migration)
-- For existing artifacts, get storyId from their workflow run
UPDATE "artifacts" a
SET "story_id" = wr."story_id"
FROM "workflow_runs" wr
WHERE a."workflow_run_id" = wr.id
AND wr."story_id" IS NOT NULL;

-- Step 3b: Delete orphaned artifacts that cannot be migrated
-- These are artifacts from workflow runs without a story
DELETE FROM "artifacts" WHERE "story_id" IS NULL;

-- Step 4: Deduplicate artifacts per (definition_id, story_id)
-- Keep the newest artifact (by updated_at) for each unique pair
-- First, identify which artifacts to delete (duplicates, not the latest)
WITH ranked_artifacts AS (
    SELECT
        id,
        definition_id,
        story_id,
        ROW_NUMBER() OVER (
            PARTITION BY definition_id, story_id
            ORDER BY updated_at DESC, created_at DESC
        ) as rn
    FROM "artifacts"
)
DELETE FROM "artifacts"
WHERE id IN (
    SELECT id FROM ranked_artifacts WHERE rn > 1
);

-- Step 5: Copy existing artifacts to version history
-- This preserves the current state as version 1
INSERT INTO "artifact_versions" (
    "artifact_id",
    "version",
    "workflow_run_id",
    "content",
    "content_hash",
    "content_type",
    "size",
    "created_by_component_id",
    "created_at"
)
SELECT
    a."id",
    a."current_version",
    a."workflow_run_id",
    a."content",
    COALESCE(a."content_hash", md5(a."content")),
    a."content_type",
    a."size",
    a."created_by_component_id",
    a."created_at"
FROM "artifacts" a;

-- Step 6: Set last_updated_run_id to current workflow_run_id
UPDATE "artifacts"
SET "last_updated_run_id" = "workflow_run_id";

-- Step 7: Drop old unique constraint BEFORE making changes
ALTER TABLE "artifacts" DROP CONSTRAINT IF EXISTS "artifacts_definition_id_workflow_run_id_key";

-- Step 8: Make workflow_run_id nullable and story_id required
ALTER TABLE "artifacts" ALTER COLUMN "workflow_run_id" DROP NOT NULL;
ALTER TABLE "artifacts" ALTER COLUMN "story_id" SET NOT NULL;

-- Step 9: Create new unique constraint for story-scoped artifacts
CREATE UNIQUE INDEX "artifacts_definition_id_story_id_key" ON "artifacts"("definition_id", "story_id");

-- Step 10: Add new indexes
CREATE INDEX "artifacts_story_id_idx" ON "artifacts"("story_id");
CREATE INDEX "artifacts_definition_id_story_id_idx" ON "artifacts"("definition_id", "story_id");

-- Step 11: Add indexes for artifact_versions
CREATE UNIQUE INDEX "artifact_versions_artifact_id_version_key" ON "artifact_versions"("artifact_id", "version");
CREATE INDEX "artifact_versions_artifact_id_version_idx" ON "artifact_versions"("artifact_id", "version" DESC);
CREATE INDEX "artifact_versions_workflow_run_id_idx" ON "artifact_versions"("workflow_run_id");

-- Step 12: Add foreign key constraints
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_last_updated_run_id_fkey" FOREIGN KEY ("last_updated_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Note: workflow_run_id already made nullable in Step 8, FK constraint already exists

ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_created_by_component_id_fkey" FOREIGN KEY ("created_by_component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;
