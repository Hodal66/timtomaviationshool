-- ATT-01/02: how and when a mark was captured. ATT-03: when the low-attendance alert was last sent.
ALTER TABLE "Attendance" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'ROLL';
ALTER TABLE "Attendance" ADD COLUMN "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Applicant" ADD COLUMN "attendanceAlertAt" TIMESTAMP(3);
