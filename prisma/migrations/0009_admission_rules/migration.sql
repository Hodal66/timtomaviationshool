-- ADM-06: entry requirements an officer has confirmed for an applicant. ADM-07: when the admission letter was issued.
ALTER TABLE "Applicant" ADD COLUMN "requirementsMet" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Applicant" ADD COLUMN "admittedAt" TIMESTAMP(3);
