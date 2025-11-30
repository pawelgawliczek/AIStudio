-- ST-151: Artifact Management for Story Runner
-- Creates ArtifactDefinition, Artifact, and ArtifactAccess tables

-- CreateTable
CREATE TABLE "artifact_definitions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "schema" JSONB,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifact_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "definition_id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_component_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_access" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "definition_id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "access_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "artifact_definitions_workflow_id_idx" ON "artifact_definitions"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_definitions_workflow_id_key_key" ON "artifact_definitions"("workflow_id", "key");

-- CreateIndex
CREATE INDEX "artifacts_workflow_run_id_idx" ON "artifacts"("workflow_run_id");

-- CreateIndex
CREATE INDEX "artifacts_definition_id_workflow_run_id_idx" ON "artifacts"("definition_id", "workflow_run_id");

-- CreateIndex
CREATE INDEX "artifact_access_state_id_idx" ON "artifact_access"("state_id");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_access_definition_id_state_id_key" ON "artifact_access"("definition_id", "state_id");

-- AddForeignKey
ALTER TABLE "artifact_definitions" ADD CONSTRAINT "artifact_definitions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "artifact_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_created_by_component_id_fkey" FOREIGN KEY ("created_by_component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_access" ADD CONSTRAINT "artifact_access_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "artifact_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_access" ADD CONSTRAINT "artifact_access_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "workflow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
