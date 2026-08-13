-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "returnedAt" TIMESTAMP(3),
ADD COLUMN "returnedReason" TEXT,
ADD COLUMN "refundedTzs" DOUBLE PRECISION,
ADD COLUMN "returnedToCampId" TEXT,
ADD COLUMN "returnedById" TEXT;

-- CreateIndex
CREATE INDEX "Sale_returnedAt_idx" ON "Sale"("returnedAt");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_returnedToCampId_fkey" FOREIGN KEY ("returnedToCampId") REFERENCES "Camp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
