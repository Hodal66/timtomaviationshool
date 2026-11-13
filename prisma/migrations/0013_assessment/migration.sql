-- ASM-01..05: grading schemes, assessments, grades, submissions, appeals. ASM-04/CRT-04: IATA/ICAO exams. CRT-01/03: certificate details and audit.
ALTER TABLE "Programme" ADD COLUMN "gradingScheme" JSONB;
CREATE TABLE "Assessment" (
  "id" TEXT NOT NULL, "groupId" TEXT NOT NULL, "title" TEXT NOT NULL, "component" TEXT NOT NULL, "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100, "heldOn" TIMESTAMP(3),
  "instructions" TEXT, "dueOn" TIMESTAMP(3), "acceptsSubmissions" BOOLEAN NOT NULL DEFAULT false, "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdBy" TEXT NOT NULL, "createdById" TEXT,
  "submittedBy" TEXT, "approvedBy" TEXT, "reviewNote" TEXT, "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Assessment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Assessment_groupId_idx" ON "Assessment"("groupId");
CREATE TABLE "Grade" (
  "id" TEXT NOT NULL, "assessmentId" TEXT NOT NULL, "applicantId" TEXT NOT NULL, "score" DOUBLE PRECISION NOT NULL, "feedback" TEXT, "updatedBy" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Grade_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Grade_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Grade_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Grade_assessmentId_applicantId_key" ON "Grade"("assessmentId", "applicantId");
CREATE TABLE "Submission" (
  "id" TEXT NOT NULL, "assessmentId" TEXT NOT NULL, "applicantId" TEXT NOT NULL, "filename" TEXT NOT NULL, "mime" TEXT NOT NULL, "size" INTEGER NOT NULL, "data" BYTEA NOT NULL, "note" TEXT, "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Submission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Submission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Submission_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Submission_assessmentId_applicantId_key" ON "Submission"("assessmentId", "applicantId");
CREATE TABLE "Appeal" (
  "id" TEXT NOT NULL, "gradeId" TEXT NOT NULL, "applicantId" TEXT NOT NULL, "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "oldScore" DOUBLE PRECISION, "newScore" DOUBLE PRECISION, "note" TEXT, "decidedBy" TEXT, "decidedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Appeal_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ExternalExam" (
  "id" TEXT NOT NULL, "applicantId" TEXT NOT NULL, "body" TEXT NOT NULL, "examName" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'REQUESTED', "feeAmount" INTEGER, "feeCurrency" TEXT NOT NULL DEFAULT 'USD', "feePaidToBodyOn" TIMESTAMP(3),
  "examDate" TIMESTAMP(3), "result" TEXT, "certificateNo" TEXT, "certificateReceivedOn" TIMESTAMP(3), "updatedBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalExam_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalExam_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "Certificate" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'Certificate';
ALTER TABLE "Certificate" ADD COLUMN "finalMark" DOUBLE PRECISION;
ALTER TABLE "Certificate" ADD COLUMN "issuedBy" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "Certificate" ADD COLUMN "revokedBy" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "revokeReason" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "replacesNumber" TEXT;
