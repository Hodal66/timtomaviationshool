-- VCL (P1) and LMS-01: online and hybrid classes with Google Meet, Meet attendance detail, class-limited recordings.
ALTER TABLE "TimetableSlot" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'CAMPUS', ADD COLUMN "meetUrl" TEXT, ADD COLUMN "meetEventId" TEXT;
ALTER TABLE "ClassSession" ADD COLUMN "meetImportedAt" TIMESTAMP(3), ADD COLUMN "log" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Attendance" ADD COLUMN "joinAt" TIMESTAMP(3), ADD COLUMN "leaveAt" TIMESTAMP(3), ADD COLUMN "minutes" INTEGER, ADD COLUMN "note" TEXT;
ALTER TABLE "Programme" ADD COLUMN "meetRules" JSONB;
ALTER TABLE "Applicant" ADD COLUMN "schoolEmail" TEXT;
ALTER TABLE "Resource" ADD COLUMN "groupId" TEXT;
