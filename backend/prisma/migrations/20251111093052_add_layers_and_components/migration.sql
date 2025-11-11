-- CreateEnum
CREATE TYPE "LayerStatus" AS ENUM ('active', 'deprecated');

-- CreateEnum
CREATE TYPE "ComponentStatus" AS ENUM ('active', 'deprecated', 'planning');

-- AlterTable
ALTER TABLE "stories" ADD COLUMN "ba_analysis" TEXT,
ADD COLUMN "architect_analysis" TEXT;

-- AlterTable
ALTER TABLE "use_cases" ADD COLUMN "component_id" UUID,
ADD COLUMN "layer_id" UUID;

-- AlterTable
ALTER TABLE "test_cases" ADD COLUMN "component_id" UUID,
ADD COLUMN "layer_id" UUID;

-- CreateTable
CREATE TABLE "layers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tech_stack" TEXT[],
    "order_index" INTEGER NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "status" "LayerStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "components" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" UUID,
    "status" "ComponentStatus" NOT NULL DEFAULT 'active',
    "color" TEXT,
    "icon" TEXT,
    "file_patterns" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_layers" (
    "component_id" UUID NOT NULL,
    "layer_id" UUID NOT NULL,

    CONSTRAINT "component_layers_pkey" PRIMARY KEY ("component_id","layer_id")
);

-- CreateTable
CREATE TABLE "story_layers" (
    "story_id" UUID NOT NULL,
    "layer_id" UUID NOT NULL,

    CONSTRAINT "story_layers_pkey" PRIMARY KEY ("story_id","layer_id")
);

-- CreateTable
CREATE TABLE "story_components" (
    "story_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,

    CONSTRAINT "story_components_pkey" PRIMARY KEY ("story_id","component_id")
);

-- CreateIndex
CREATE INDEX "layers_project_id_status_idx" ON "layers"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "layers_project_id_name_key" ON "layers"("project_id", "name");

-- CreateIndex
CREATE INDEX "components_project_id_status_idx" ON "components"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "components_project_id_name_key" ON "components"("project_id", "name");

-- CreateIndex
CREATE INDEX "use_cases_component_id_idx" ON "use_cases"("component_id");

-- CreateIndex
CREATE INDEX "use_cases_layer_id_idx" ON "use_cases"("layer_id");

-- CreateIndex
CREATE INDEX "test_cases_component_id_idx" ON "test_cases"("component_id");

-- CreateIndex
CREATE INDEX "test_cases_layer_id_idx" ON "test_cases"("layer_id");

-- AddForeignKey
ALTER TABLE "layers" ADD CONSTRAINT "layers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_layers" ADD CONSTRAINT "component_layers_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_layers" ADD CONSTRAINT "component_layers_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "layers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_layers" ADD CONSTRAINT "story_layers_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_layers" ADD CONSTRAINT "story_layers_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "layers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_components" ADD CONSTRAINT "story_components_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_components" ADD CONSTRAINT "story_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "use_cases" ADD CONSTRAINT "use_cases_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "use_cases" ADD CONSTRAINT "use_cases_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "layers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "layers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
