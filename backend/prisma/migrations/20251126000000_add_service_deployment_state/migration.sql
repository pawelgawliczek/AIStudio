-- ST-115: Add ServiceDeploymentState table for intelligent build change detection
-- Tracks last deployed commit per service to enable skipping unchanged service builds

-- CreateTable
CREATE TABLE "service_deployment_states" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "service" TEXT NOT NULL,
    "last_deployed_commit" TEXT NOT NULL,
    "last_deployed_at" TIMESTAMP(3) NOT NULL,
    "files_changed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_deployment_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_deployment_states_service_key" ON "service_deployment_states"("service");
