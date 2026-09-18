-- AlterTable
ALTER TABLE "LabExperiment" ADD COLUMN "productName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LabExperiment" ADD COLUMN "recipeCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LabExperiment" ADD COLUMN "materialUsages" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "LabExperiment" ADD COLUMN "recipeId" TEXT;
ALTER TABLE "LabExperiment" ADD COLUMN "completionNote" TEXT;
