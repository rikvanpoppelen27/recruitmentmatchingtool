-- AlterTable
ALTER TABLE "Candidate" DROP COLUMN "firstName",
DROP COLUMN "lastName",
ADD COLUMN     "availability" TEXT,
ADD COLUMN     "cvFileHash" TEXT NOT NULL,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "phoneRaw" TEXT;

-- CreateTable
CREATE TABLE "WorkExperience" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobTitle" TEXT,
    "employer" TEXT,
    "period" TEXT,
    "description" TEXT,

    CONSTRAINT "WorkExperience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_cvFileHash_key" ON "Candidate"("cvFileHash");

-- AddForeignKey
ALTER TABLE "WorkExperience" ADD CONSTRAINT "WorkExperience_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

