-- AlterEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "grazingFeeExempt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable OtherIncome — no structural change needed until OwnerPayment FK

-- CreateTable
CREATE TABLE "OwnerInvoice" (
    "id" TEXT NOT NULL,
    "ranchId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "animalCount" INTEGER NOT NULL,
    "rateTzs" DOUBLE PRECISION NOT NULL,
    "amountTzs" DOUBLE PRECISION NOT NULL,
    "amountPaidTzs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerPayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountTzs" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "otherIncomeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnerInvoice_ranchId_status_idx" ON "OwnerInvoice"("ranchId", "status");

-- CreateIndex
CREATE INDEX "OwnerInvoice_ownerId_idx" ON "OwnerInvoice"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerInvoice_ranchId_ownerId_periodYear_periodMonth_key" ON "OwnerInvoice"("ranchId", "ownerId", "periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerPayment_otherIncomeId_key" ON "OwnerPayment"("otherIncomeId");

-- CreateIndex
CREATE INDEX "OwnerPayment_invoiceId_idx" ON "OwnerPayment"("invoiceId");

-- CreateIndex
CREATE INDEX "OwnerPayment_paidAt_idx" ON "OwnerPayment"("paidAt");

-- AddForeignKey
ALTER TABLE "OwnerInvoice" ADD CONSTRAINT "OwnerInvoice_ranchId_fkey" FOREIGN KEY ("ranchId") REFERENCES "Ranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerInvoice" ADD CONSTRAINT "OwnerInvoice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerPayment" ADD CONSTRAINT "OwnerPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "OwnerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerPayment" ADD CONSTRAINT "OwnerPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerPayment" ADD CONSTRAINT "OwnerPayment_otherIncomeId_fkey" FOREIGN KEY ("otherIncomeId") REFERENCES "OtherIncome"("id") ON DELETE SET NULL ON UPDATE CASCADE;
