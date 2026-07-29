-- CreateTable
CREATE TABLE "AnimalPhoto" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedCatalog" (
    "id" TEXT NOT NULL,
    "ranchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreedCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalPhoto_animalId_idx" ON "AnimalPhoto"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "BreedCatalog_ranchId_name_key" ON "BreedCatalog"("ranchId", "name");

-- AddForeignKey
ALTER TABLE "AnimalPhoto" ADD CONSTRAINT "AnimalPhoto_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPhoto" ADD CONSTRAINT "AnimalPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedCatalog" ADD CONSTRAINT "BreedCatalog_ranchId_fkey" FOREIGN KEY ("ranchId") REFERENCES "Ranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropColumn (legacy unused array)
ALTER TABLE "Animal" DROP COLUMN IF EXISTS "photoGallery";
