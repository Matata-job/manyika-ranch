-- CreateTable
CREATE TABLE "CampNote" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "noteDate" DATE NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampNote_campId_noteDate_idx" ON "CampNote"("campId", "noteDate");

-- AddForeignKey
ALTER TABLE "CampNote" ADD CONSTRAINT "CampNote_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampNote" ADD CONSTRAINT "CampNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
