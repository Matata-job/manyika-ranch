-- Soft-delete / retention for camps and animals
ALTER TABLE "Camp" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Camp" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Camp" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

ALTER TABLE "Animal" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Animal" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

CREATE INDEX IF NOT EXISTS "Camp_ranchId_deletedAt_idx" ON "Camp"("ranchId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Camp_ranchId_isActive_idx" ON "Camp"("ranchId", "isActive");
CREATE INDEX IF NOT EXISTS "Animal_deletedAt_idx" ON "Animal"("deletedAt");
