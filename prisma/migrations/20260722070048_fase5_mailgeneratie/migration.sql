-- CreateEnum
CREATE TYPE "EmailVariant" AS ENUM ('STANDAARD', 'KORTER', 'FORMELER', 'INFORMELER');

-- DropIndex
DROP INDEX "EmailDraft_matchId_key";

-- AlterTable
ALTER TABLE "EmailDraft" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'concept',
ADD COLUMN     "variant" "EmailVariant" NOT NULL DEFAULT 'STANDAARD';

-- AlterTable
ALTER TABLE "StyleProfile" DROP COLUMN "content",
ADD COLUMN     "content" JSONB NOT NULL;

-- CreateIndex
CREATE INDEX "EmailDraft_matchId_idx" ON "EmailDraft"("matchId");
