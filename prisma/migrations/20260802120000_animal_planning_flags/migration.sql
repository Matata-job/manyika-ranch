-- Animal planning flags: keep for breeding / next sale cycle
ALTER TABLE "Animal" ADD COLUMN "keepForBreeding" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Animal" ADD COLUMN "markedForSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Animal" ADD COLUMN "breedingNote" TEXT;
ALTER TABLE "Animal" ADD COLUMN "saleCycleNote" TEXT;
ALTER TABLE "Animal" ADD COLUMN "keepForBreedingAt" TIMESTAMP(3);
ALTER TABLE "Animal" ADD COLUMN "markedForSaleAt" TIMESTAMP(3);

CREATE INDEX "Animal_keepForBreeding_idx" ON "Animal"("keepForBreeding");
CREATE INDEX "Animal_markedForSale_idx" ON "Animal"("markedForSale");
