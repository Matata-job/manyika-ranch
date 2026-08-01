-- Align medicine stock and pending movements for automated alerts

CREATE TYPE "MovementStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Movement" ADD COLUMN "status" "MovementStatus" NOT NULL DEFAULT 'COMPLETED';

ALTER TABLE "MedicineInventory" ADD COLUMN "ranchId" TEXT;
ALTER TABLE "MedicineInventory" ADD COLUMN "minQuantity" DOUBLE PRECISION NOT NULL DEFAULT 10;

UPDATE "MedicineInventory" AS m
SET "ranchId" = c."ranchId"
FROM "Camp" AS c
WHERE m."campId" = c."id" AND m."ranchId" IS NULL;

UPDATE "MedicineInventory"
SET "ranchId" = (SELECT "id" FROM "Ranch" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "ranchId" IS NULL;

ALTER TABLE "MedicineInventory" ALTER COLUMN "ranchId" SET NOT NULL;

ALTER TABLE "MedicineInventory"
  ADD CONSTRAINT "MedicineInventory_ranchId_fkey"
  FOREIGN KEY ("ranchId") REFERENCES "Ranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "MedicineInventory_ranchId_idx" ON "MedicineInventory"("ranchId");
CREATE INDEX "Movement_status_idx" ON "Movement"("status");
