-- AlterTable
ALTER TABLE "Camp" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Camp" ADD COLUMN IF NOT EXISTS "tagColor" TEXT;
ALTER TABLE "Camp" ADD COLUMN IF NOT EXISTS "legacyCode" TEXT;

-- Unique camp code per ranch (NULLs allowed for legacy rows until backfilled)
CREATE UNIQUE INDEX IF NOT EXISTS "Camp_ranchId_code_key" ON "Camp"("ranchId", "code");
