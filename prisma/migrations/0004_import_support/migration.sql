-- AlterTable
ALTER TABLE "Programme" ADD COLUMN     "heroImage" TEXT,
ALTER COLUMN "durationMonths" DROP NOT NULL,
ALTER COLUMN "durationMonths" DROP DEFAULT;

