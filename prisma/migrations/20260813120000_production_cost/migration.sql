-- CreateEnum
CREATE TYPE "ExpenseFundingSource" AS ENUM ('OPERATING', 'PROJECT');

-- CreateEnum
CREATE TYPE "ExpenseAllocGroup" AS ENUM ('NONE', 'ALL_ACTIVE', 'SELL_NEXT_CYCLE', 'KEEP_BREEDING', 'KULIMA');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "fundingSource" "ExpenseFundingSource" NOT NULL DEFAULT 'OPERATING';
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "allocGroup" "ExpenseAllocGroup" NOT NULL DEFAULT 'NONE';

-- Existing feed purchases share across animals present in the camp (or ranch).
UPDATE "Expense" SET "allocGroup" = 'ALL_ACTIVE' WHERE "category" = 'FEED';

-- AlterTable
ALTER TABLE "Animal" ADD COLUMN IF NOT EXISTS "purchasePriceTzs" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Treatment" ADD COLUMN IF NOT EXISTS "costTzs" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Expense_fundingSource_idx" ON "Expense"("fundingSource");
