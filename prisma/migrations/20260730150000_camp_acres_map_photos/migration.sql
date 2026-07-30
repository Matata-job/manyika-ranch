-- Replace capacity with size in acres; add logo and photos
ALTER TABLE "Camp" ADD COLUMN "sizeAcres" DOUBLE PRECISION;
ALTER TABLE "Camp" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Camp" DROP COLUMN IF EXISTS "capacity";

CREATE TABLE "CampPhoto" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampPhoto_campId_idx" ON "CampPhoto"("campId");

ALTER TABLE "CampPhoto" ADD CONSTRAINT "CampPhoto_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampPhoto" ADD CONSTRAINT "CampPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
