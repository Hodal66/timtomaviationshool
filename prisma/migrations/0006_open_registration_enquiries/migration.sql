-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- DropForeignKey
ALTER TABLE "ProgrammeOffering" DROP CONSTRAINT "ProgrammeOffering_programmeId_fkey";

-- DropForeignKey
ALTER TABLE "ProgrammeOffering" DROP CONSTRAINT "ProgrammeOffering_intakeId_fkey";

-- DropForeignKey
ALTER TABLE "ProgrammeOffering" DROP CONSTRAINT "ProgrammeOffering_branchId_fkey";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "handledBy" TEXT,
ADD COLUMN     "status" "LeadStatus" NOT NULL DEFAULT 'NEW';

-- DropTable
DROP TABLE "ProgrammeOffering";

-- DropEnum
DROP TYPE "OfferingStatus";

