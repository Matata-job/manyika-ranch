-- AlterTable VaccineCatalog
ALTER TABLE "VaccineCatalog" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "TreatmentCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TreatmentType" NOT NULL DEFAULT 'OTHER',
    "intervalDays" INTEGER,
    "withdrawalPeriod" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentCatalog_name_key" ON "TreatmentCatalog"("name");

-- AlterTable Treatment
ALTER TABLE "Treatment" ADD COLUMN "treatmentCatalogId" TEXT;
ALTER TABLE "Treatment" ADD COLUMN "nextDue" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Treatment_nextDue_idx" ON "Treatment"("nextDue");

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_treatmentCatalogId_fkey" FOREIGN KEY ("treatmentCatalogId") REFERENCES "TreatmentCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
