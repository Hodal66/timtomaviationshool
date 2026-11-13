-- LEC-17..20, 22: monthly payment claims with clearance, approval chain, payment and queries.
CREATE TABLE "PaymentClaim" (
  "id" TEXT NOT NULL, "lecturerId" TEXT NOT NULL, "period" TEXT NOT NULL, "payModel" TEXT NOT NULL, "rate" INTEGER NOT NULL, "currency" TEXT NOT NULL, "units" DOUBLE PRECISION NOT NULL, "amount" INTEGER NOT NULL,
  "lines" JSONB NOT NULL, "clearance" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'SUBMITTED', "history" JSONB NOT NULL DEFAULT '[]', "paidRef" TEXT, "paidAt" TIMESTAMP(3), "openQuery" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentClaim_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentClaim_lecturerId_period_key" ON "PaymentClaim"("lecturerId", "period");
