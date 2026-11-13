-- LEC-01..06, 12..16: lecturer records, sensitive-change approvals, lesson reports, substitute requests. User.active supports archive (LEC-04).
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "LecturerProfile" (
  "userId" TEXT NOT NULL, "phone" TEXT, "nationalId" TEXT, "qualifications" TEXT, "licences" TEXT, "industryRole" TEXT, "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[], "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "branchIds" TEXT[] DEFAULT ARRAY[]::TEXT[], "payModel" TEXT NOT NULL DEFAULT 'HOUR', "rate" INTEGER NOT NULL DEFAULT 0, "currency" TEXT NOT NULL DEFAULT 'RWF', "payChannel" TEXT NOT NULL DEFAULT 'BANK', "bankName" TEXT, "accountNumber" TEXT,
  "taxStatus" TEXT, "contractStart" TIMESTAMP(3), "contractEnd" TIMESTAMP(3), "maxHoursWeek" INTEGER NOT NULL DEFAULT 20, "availability" JSONB NOT NULL DEFAULT '{}', "onboarding" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LecturerProfile_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "LecturerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ProfileChange" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "fields" JSONB NOT NULL, "previous" JSONB NOT NULL, "requestedBy" TEXT NOT NULL, "requestedById" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "decidedBy" TEXT, "decidedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfileChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "LessonReport" (
  "id" TEXT NOT NULL, "slotId" TEXT NOT NULL, "date" DATE NOT NULL, "lecturerId" TEXT NOT NULL, "topic" TEXT NOT NULL, "notes" TEXT, "issues" TEXT, "onTime" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonReport_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TimetableSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LessonReport_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LessonReport_slotId_date_key" ON "LessonReport"("slotId", "date");
CREATE TABLE "SubstituteRequest" (
  "id" TEXT NOT NULL, "slotId" TEXT NOT NULL, "date" DATE NOT NULL, "lecturerId" TEXT NOT NULL, "substituteId" TEXT, "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "decidedBy" TEXT, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubstituteRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubstituteRequest_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TimetableSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SubstituteRequest_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
