-- AlterTable
ALTER TABLE "Treatment" ADD COLUMN IF NOT EXISTS "healthRecordId" TEXT;

-- AlterTable
ALTER TABLE "Vaccination" ADD COLUMN IF NOT EXISTS "healthRecordId" TEXT;
ALTER TABLE "Vaccination" ADD COLUMN IF NOT EXISTS "costTzs" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "HealthRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "HealthRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Treatment_healthRecordId_idx" ON "Treatment"("healthRecordId");
CREATE INDEX IF NOT EXISTS "Vaccination_healthRecordId_idx" ON "Vaccination"("healthRecordId");
