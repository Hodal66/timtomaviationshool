-- Email one-time passcodes: applicants prove they own an email address before they can apply or see their dashboard.
CREATE TABLE "EmailOtp" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailOtp_email_createdAt_idx" ON "EmailOtp"("email", "createdAt");
ALTER TABLE "Applicant" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
