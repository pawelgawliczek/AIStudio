-- ST-207: Add taxonomy field to projects table
-- AlterTable
ALTER TABLE "projects" ADD COLUMN "taxonomy" JSONB;
