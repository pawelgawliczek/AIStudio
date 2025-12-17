-- ST-273: Remove deployment infrastructure
-- Drop deployment-related tables and enums

-- Drop foreign key constraints first (Story relations)
ALTER TABLE "stories" DROP CONSTRAINT IF EXISTS "stories_deployment_locks_fkey";
ALTER TABLE "stories" DROP CONSTRAINT IF EXISTS "stories_deployment_logs_fkey";

-- Drop tables
DROP TABLE IF EXISTS "deployment_locks" CASCADE;
DROP TABLE IF EXISTS "deployment_logs" CASCADE;
DROP TABLE IF EXISTS "service_deployment_states" CASCADE;

-- Drop enum
DROP TYPE IF EXISTS "DeploymentStatus";
