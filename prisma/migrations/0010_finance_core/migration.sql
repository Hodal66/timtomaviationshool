-- FIN-01/04: tuition invoices, installments and due dates. FIN-02/03: payment claims and statement matching. FIN-05: exchange rates.
ALTER TABLE "Invoice" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'REGISTRATION';
ALTER TABLE "Invoice" ADD COLUMN "dueOn" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "installment" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "remindedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "valueRwf" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "claimedBy" TEXT NOT NULL DEFAULT 'FINANCE';
ALTER TABLE "Payment" ADD COLUMN "note" TEXT;
CREATE TABLE "ExchangeRate" (
  "currency" "Currency" NOT NULL,
  "rwfPerUnit" DOUBLE PRECISION NOT NULL,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("currency")
);
