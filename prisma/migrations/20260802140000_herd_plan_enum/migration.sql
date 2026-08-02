-- Convert boolean planning flags to HerdPlan enum (EXCLUDED default)

CREATE TYPE "HerdPlan" AS ENUM ('EXCLUDED', 'KEEP_BREEDING', 'SELL_NEXT_CYCLE');

ALTER TABLE "Animal" ADD COLUMN "herdPlan" "HerdPlan" NOT NULL DEFAULT 'EXCLUDED';
ALTER TABLE "Animal" ADD COLUMN "herdPlanNote" TEXT;
ALTER TABLE "Animal" ADD COLUMN "herdPlanAt" TIMESTAMP(3);

-- Migrate existing flags (KEEP wins if both were somehow set)
UPDATE "Animal"
SET
  "herdPlan" = 'SELL_NEXT_CYCLE',
  "herdPlanNote" = "saleCycleNote",
  "herdPlanAt" = "markedForSaleAt"
WHERE "markedForSale" = true;

UPDATE "Animal"
SET
  "herdPlan" = 'KEEP_BREEDING',
  "herdPlanNote" = "breedingNote",
  "herdPlanAt" = "keepForBreedingAt"
WHERE "keepForBreeding" = true;

DROP INDEX IF EXISTS "Animal_keepForBreeding_idx";
DROP INDEX IF EXISTS "Animal_markedForSale_idx";

ALTER TABLE "Animal" DROP COLUMN IF EXISTS "keepForBreeding";
ALTER TABLE "Animal" DROP COLUMN IF EXISTS "markedForSale";
ALTER TABLE "Animal" DROP COLUMN IF EXISTS "breedingNote";
ALTER TABLE "Animal" DROP COLUMN IF EXISTS "saleCycleNote";
ALTER TABLE "Animal" DROP COLUMN IF EXISTS "keepForBreedingAt";
ALTER TABLE "Animal" DROP COLUMN IF EXISTS "markedForSaleAt";

CREATE INDEX "Animal_herdPlan_idx" ON "Animal"("herdPlan");
