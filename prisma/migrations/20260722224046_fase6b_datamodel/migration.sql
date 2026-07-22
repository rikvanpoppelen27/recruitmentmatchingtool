-- CreateEnum
CREATE TYPE "VacancySource" AS ENUM ('ADZUNA', 'LINKEDIN', 'INDEED', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CreatedBy" AS ENUM ('IMPORT', 'MANUAL');

-- AlterEnum
ALTER TYPE "JobSource" ADD VALUE 'MANUAL';

-- DropIndex
DROP INDEX "Vacancy_source_externalId_idx";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
-- Bestaande "source"-kolom (JobSource, tot nu toe altijd 'ADZUNA') hernoemen
-- naar "importSource" i.p.v. droppen+opnieuw aanmaken: behoudt bestaande data
-- zonder backfill, en voorkomt een NOT NULL-kolom zonder default op een
-- tabel met bestaande rijen.
ALTER TABLE "Vacancy" RENAME COLUMN "source" TO "importSource";

ALTER TABLE "Vacancy" ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "createdBy" "CreatedBy" NOT NULL DEFAULT 'IMPORT',
ADD COLUMN     "isShortlisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shortlistedAt" TIMESTAMP(3),
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "source" "VacancySource" NOT NULL DEFAULT 'ADZUNA';

-- CreateTable
CREATE TABLE "FrontsheetRevision" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrontsheetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemInstruction" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FrontsheetRevision_matchId_idx" ON "FrontsheetRevision"("matchId");

-- CreateIndex
CREATE INDEX "Vacancy_importSource_externalId_idx" ON "Vacancy"("importSource", "externalId");

-- CreateIndex
CREATE INDEX "Vacancy_isShortlisted_idx" ON "Vacancy"("isShortlisted");

-- AddForeignKey
ALTER TABLE "FrontsheetRevision" ADD CONSTRAINT "FrontsheetRevision_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
