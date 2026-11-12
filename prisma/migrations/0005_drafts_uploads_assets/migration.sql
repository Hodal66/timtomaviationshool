-- AlterTable
ALTER TABLE "Applicant" ADD COLUMN     "completionYear" INTEGER,
ADD COLUMN     "educationLevel" TEXT,
ADD COLUMN     "institution" TEXT;

-- CreateTable
CREATE TABLE "ApplicationDraft" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "draftId" TEXT,
    "applicantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDraft_token_key" ON "ApplicationDraft"("token");

-- CreateIndex
CREATE INDEX "ApplicationDraft_updatedAt_idx" ON "ApplicationDraft"("updatedAt");

-- CreateIndex
CREATE INDEX "Upload_draftId_idx" ON "Upload"("draftId");

-- CreateIndex
CREATE INDEX "Upload_applicantId_idx" ON "Upload"("applicantId");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ApplicationDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

