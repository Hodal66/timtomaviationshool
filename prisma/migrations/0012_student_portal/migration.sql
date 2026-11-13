-- STU-02: emergency contact. STU-03/06: requests with approval. STU-11: support tickets. COM-03/STU-01: announcements.
ALTER TABLE "Applicant" ADD COLUMN "emergencyName" TEXT;
ALTER TABLE "Applicant" ADD COLUMN "emergencyPhone" TEXT;
CREATE TABLE "StudentRequest" (
  "id" TEXT NOT NULL, "applicantId" TEXT NOT NULL, "type" TEXT NOT NULL, "detail" JSONB NOT NULL DEFAULT '{}', "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "note" TEXT, "decidedBy" TEXT, "decidedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentRequest_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentRequest_status_idx" ON "StudentRequest"("status");
CREATE TABLE "Ticket" (
  "id" TEXT NOT NULL, "applicantId" TEXT NOT NULL, "subject" TEXT NOT NULL, "category" TEXT NOT NULL DEFAULT 'General', "status" TEXT NOT NULL DEFAULT 'OPEN',
  "rating" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ticket_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");
CREATE TABLE "TicketMessage" (
  "id" TEXT NOT NULL, "ticketId" TEXT NOT NULL, "fromStaff" BOOLEAN NOT NULL DEFAULT false, "author" TEXT NOT NULL, "body" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "groupId" TEXT, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
