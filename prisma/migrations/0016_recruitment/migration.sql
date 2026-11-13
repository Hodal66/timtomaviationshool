-- LEC-07, LEC-08, LEC-10: lecturer vacancies on the website, online applications with CV and screening, offer letter and onboarding.
CREATE TABLE "Vacancy" (
  "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "title" TEXT NOT NULL, "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[], "description" TEXT NOT NULL, "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "branchId" TEXT, "payModel" TEXT NOT NULL DEFAULT 'HOUR', "closesOn" DATE, "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vacancy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Vacancy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Vacancy_slug_key" ON "Vacancy"("slug");
CREATE TABLE "JobApplication" (
  "id" TEXT NOT NULL, "vacancyId" TEXT NOT NULL, "reference" TEXT NOT NULL, "fullName" TEXT NOT NULL, "email" TEXT NOT NULL, "phone" TEXT NOT NULL, "coverNote" TEXT,
  "answers" JSONB NOT NULL DEFAULT '{}', "cvName" TEXT NOT NULL, "cvMime" TEXT NOT NULL, "cvSize" INTEGER NOT NULL, "cv" BYTEA NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW', "score" INTEGER, "history" JSONB NOT NULL DEFAULT '[]', "offer" JSONB, "onboarding" JSONB, "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobApplication_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "JobApplication_reference_key" ON "JobApplication"("reference");
CREATE UNIQUE INDEX "JobApplication_vacancyId_email_key" ON "JobApplication"("vacancyId", "email");
