-- ST-362: Add epic-level artifact support
-- This migration adds:
-- 1. epicId to Artifact table (nullable, for epic-scoped artifacts)
-- 2. projectId to ArtifactDefinition table (nullable, for global definitions)
-- 3. Makes storyId in Artifact nullable
-- 4. Makes workflowId in ArtifactDefinition nullable (already done in schema)

-- Step 1: Add projectId to ArtifactDefinition for global definitions
ALTER TABLE "artifact_definitions" ADD COLUMN "project_id" UUID;

-- Step 2: Add foreign key for projectId
ALTER TABLE "artifact_definitions"
  ADD CONSTRAINT "artifact_definitions_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;

-- Step 3: Add index for projectId queries
CREATE INDEX "artifact_definitions_project_id_idx" ON "artifact_definitions"("project_id");

-- Step 4: Add unique constraint for global definitions (projectId, key)
-- Note: This allows NULL values in both columns, so it only enforces uniqueness when both are set
CREATE UNIQUE INDEX "artifact_definitions_project_id_key_key"
  ON "artifact_definitions"("project_id", "key")
  WHERE "project_id" IS NOT NULL;

-- Step 5: Add epicId to Artifact table
ALTER TABLE "artifacts" ADD COLUMN "epic_id" UUID;

-- Step 6: Make storyId nullable in Artifact table
ALTER TABLE "artifacts" ALTER COLUMN "story_id" DROP NOT NULL;

-- Step 7: Add foreign key for epicId
ALTER TABLE "artifacts"
  ADD CONSTRAINT "artifacts_epic_id_fkey"
  FOREIGN KEY ("epic_id") REFERENCES "epics"("id") ON DELETE CASCADE;

-- Step 8: Add index for epic-scoped queries
CREATE INDEX "artifacts_epic_id_idx" ON "artifacts"("epic_id");

-- Step 9: Add unique constraint for epic-scoped artifacts (definitionId, epicId)
-- Note: This allows NULL values, so it only enforces uniqueness when both are set
CREATE UNIQUE INDEX "artifacts_definition_id_epic_id_key"
  ON "artifacts"("definition_id", "epic_id")
  WHERE "epic_id" IS NOT NULL;

-- Note: Application-level validation is required to ensure:
-- 1. In Artifact: Exactly one of storyId OR epicId is set (XOR constraint)
-- 2. In ArtifactDefinition: Exactly one of workflowId OR projectId is set (XOR constraint)
