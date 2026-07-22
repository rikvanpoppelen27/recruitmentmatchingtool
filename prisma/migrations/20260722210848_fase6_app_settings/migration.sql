-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "matchThreshold" INTEGER,
    "skillWeight" DOUBLE PRECISION,
    "semanticWeight" DOUBLE PRECISION,
    "mustHaveWeight" DOUBLE PRECISION,
    "niceToHaveWeight" DOUBLE PRECISION,
    "knockOutCapScore" INTEGER,
    "aiCallMustHaveThreshold" DOUBLE PRECISION,
    "anonymizeCV" BOOLEAN,
    "companyName" TEXT,
    "footerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
