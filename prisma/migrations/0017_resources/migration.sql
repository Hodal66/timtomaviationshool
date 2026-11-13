-- RES (P1): learning resources with metadata, versions, review, visibility, release/expiry, licence, view-only and a recycle bin.
CREATE TABLE "Resource" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "programmeId" TEXT, "module" TEXT, "topic" TEXT, "kind" TEXT NOT NULL DEFAULT 'NOTES', "tags" TEXT[] DEFAULT ARRAY[]::TEXT[], "language" TEXT NOT NULL DEFAULT 'en',
  "ownerId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'IN_REVIEW', "visibility" TEXT NOT NULL DEFAULT 'STUDENTS', "releaseAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "licence" TEXT NOT NULL DEFAULT 'School copyright', "viewOnly" BOOLEAN NOT NULL DEFAULT false,
  "reviewedBy" TEXT, "reviewNote" TEXT, "version" INTEGER NOT NULL DEFAULT 1, "views" INTEGER NOT NULL DEFAULT 0, "downloads" INTEGER NOT NULL DEFAULT 0, "deletedAt" TIMESTAMP(3), "deletedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Resource_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Resource_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Resource_programmeId_module_idx" ON "Resource"("programmeId", "module");
CREATE TABLE "ResourceVersion" (
  "id" TEXT NOT NULL, "resourceId" TEXT NOT NULL, "version" INTEGER NOT NULL, "filename" TEXT, "mime" TEXT, "size" INTEGER, "data" BYTEA, "url" TEXT, "note" TEXT, "uploadedBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResourceVersion_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ResourceVersion_resourceId_version_key" ON "ResourceVersion"("resourceId", "version");
