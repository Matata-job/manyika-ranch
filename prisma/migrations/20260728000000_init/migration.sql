-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'FARM_MANAGER', 'CAMP_SUPERVISOR', 'VETERINARIAN', 'RECORDS_CLERK', 'EXTERNAL_OWNER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('ACTIVE', 'SOLD', 'DECEASED', 'MISSING', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "AcquisitionType" AS ENUM ('BORN_ON_FARM', 'PURCHASED', 'GIFT');

-- CreateEnum
CREATE TYPE "HealthType" AS ENUM ('ILLNESS', 'INJURY', 'CHECKUP', 'OTHER');

-- CreateEnum
CREATE TYPE "TreatmentType" AS ENUM ('DEWORMING', 'DIPPING', 'ANTIBIOTIC', 'OTHER');

-- CreateEnum
CREATE TYPE "BreedingMethod" AS ENUM ('NATURAL', 'AI');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('VACCINATION_DUE', 'WEIGHT_BELOW_TARGET', 'MOVEMENT_PENDING', 'MEDICINE_LOW', 'OTHER');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DeathCause" AS ENUM ('DISEASE', 'INJURY', 'PREDATION', 'DROUGHT_STARVATION', 'BIRTHING', 'OLD_AGE', 'CULLING', 'UNKNOWN', 'OTHER');

-- CreateEnum
CREATE TYPE "DisposalMethod" AS ENUM ('BURIED', 'BURNED', 'SOLD_CARCASS', 'REMOVED', 'OTHER');

-- CreateEnum
CREATE TYPE "AnimalEventType" AS ENUM ('REGISTERED', 'WEIGHT', 'HEALTH', 'VACCINATION', 'TREATMENT', 'MOVEMENT', 'BREEDING', 'CALVING', 'OWNERSHIP_TRANSFER', 'STATUS_CHANGE', 'QUARANTINE', 'SALE', 'DEATH', 'CULLING', 'NOTE', 'OTHER');

-- CreateTable
CREATE TABLE "Ranch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Singida, Tanzania',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "ranchId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCampAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCampAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camp" (
    "id" TEXT NOT NULL,
    "ranchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capacity" INTEGER,
    "waterSources" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastureBlock" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PastureBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "eartag" TEXT NOT NULL,
    "rfidChip" TEXT,
    "photoUrl" TEXT,
    "photoGallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "breed" TEXT NOT NULL,
    "sex" "Sex" NOT NULL,
    "dob" TIMESTAMP(3),
    "ageMonths" INTEGER,
    "ownerId" TEXT NOT NULL,
    "sireId" TEXT,
    "damId" TEXT,
    "campId" TEXT NOT NULL,
    "status" "AnimalStatus" NOT NULL DEFAULT 'ACTIVE',
    "acquisitionType" "AcquisitionType" NOT NULL DEFAULT 'BORN_ON_FARM',
    "acquisitionDate" TIMESTAMP(3),
    "colorMarkings" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightLog" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'scale',
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthRecord" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "HealthType" NOT NULL,
    "diagnosis" TEXT,
    "treatment" TEXT,
    "outcome" TEXT,
    "vetId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaccineCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intervalDays" INTEGER,
    "species" TEXT NOT NULL DEFAULT 'cattle',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaccineCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "vaccineCatalogId" TEXT,
    "vaccineName" TEXT NOT NULL,
    "batchNo" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextDue" TIMESTAMP(3),
    "administeredById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treatment" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "TreatmentType" NOT NULL,
    "product" TEXT NOT NULL,
    "dose" TEXT,
    "withdrawalPeriod" INTEGER,
    "administeredById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingEvent" (
    "id" TEXT NOT NULL,
    "damId" TEXT NOT NULL,
    "sireId" TEXT,
    "matingDate" TIMESTAMP(3) NOT NULL,
    "method" "BreedingMethod" NOT NULL DEFAULT 'NATURAL',
    "pregnancyConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreedingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalvingRecord" (
    "id" TEXT NOT NULL,
    "breedingEventId" TEXT,
    "damId" TEXT NOT NULL,
    "calfId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "birthWeightKg" DOUBLE PRECISION,
    "complications" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalvingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "fromCampId" TEXT NOT NULL,
    "toCampId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "authorizedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipTransfer" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "fromOwnerId" TEXT NOT NULL,
    "toOwnerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" DOUBLE PRECISION,
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "buyer" TEXT NOT NULL,
    "priceTzs" DOUBLE PRECISION NOT NULL,
    "weightAtSale" DOUBLE PRECISION,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transport" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeathRecord" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cause" "DeathCause" NOT NULL DEFAULT 'UNKNOWN',
    "causeDetail" TEXT,
    "disposalMethod" "DisposalMethod" NOT NULL DEFAULT 'BURIED',
    "disposalNotes" TEXT,
    "location" TEXT,
    "weightKg" DOUBLE PRECISION,
    "insuranceClaim" BOOLEAN NOT NULL DEFAULT false,
    "claimAmountTzs" DOUBLE PRECISION,
    "claimReference" TEXT,
    "isCulling" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeathRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalEvent" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" "AnimalEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineInventory" (
    "id" TEXT NOT NULL,
    "campId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'doses',
    "expiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicineInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RainfallLog" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mm" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RainfallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "animalId" TEXT,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserCampAssignment_userId_campId_key" ON "UserCampAssignment"("userId", "campId");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_eartag_key" ON "Animal"("eartag");

-- CreateIndex
CREATE INDEX "Animal_campId_idx" ON "Animal"("campId");

-- CreateIndex
CREATE INDEX "Animal_ownerId_idx" ON "Animal"("ownerId");

-- CreateIndex
CREATE INDEX "Animal_status_idx" ON "Animal"("status");

-- CreateIndex
CREATE INDEX "WeightLog_animalId_date_idx" ON "WeightLog"("animalId", "date");

-- CreateIndex
CREATE INDEX "HealthRecord_animalId_date_idx" ON "HealthRecord"("animalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "VaccineCatalog_name_key" ON "VaccineCatalog"("name");

-- CreateIndex
CREATE INDEX "Vaccination_animalId_date_idx" ON "Vaccination"("animalId", "date");

-- CreateIndex
CREATE INDEX "Vaccination_nextDue_idx" ON "Vaccination"("nextDue");

-- CreateIndex
CREATE INDEX "Treatment_animalId_date_idx" ON "Treatment"("animalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CalvingRecord_breedingEventId_key" ON "CalvingRecord"("breedingEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalvingRecord_calfId_key" ON "CalvingRecord"("calfId");

-- CreateIndex
CREATE INDEX "Movement_animalId_date_idx" ON "Movement"("animalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DeathRecord_animalId_key" ON "DeathRecord"("animalId");

-- CreateIndex
CREATE INDEX "DeathRecord_date_idx" ON "DeathRecord"("date");

-- CreateIndex
CREATE INDEX "DeathRecord_cause_idx" ON "DeathRecord"("cause");

-- CreateIndex
CREATE INDEX "AnimalEvent_animalId_occurredAt_idx" ON "AnimalEvent"("animalId", "occurredAt");

-- CreateIndex
CREATE INDEX "AnimalEvent_type_occurredAt_idx" ON "AnimalEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "Alert_status_dueDate_idx" ON "Alert"("status", "dueDate");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_ranchId_fkey" FOREIGN KEY ("ranchId") REFERENCES "Ranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCampAssignment" ADD CONSTRAINT "UserCampAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCampAssignment" ADD CONSTRAINT "UserCampAssignment_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camp" ADD CONSTRAINT "Camp_ranchId_fkey" FOREIGN KEY ("ranchId") REFERENCES "Ranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightLog" ADD CONSTRAINT "WeightLog_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightLog" ADD CONSTRAINT "WeightLog_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_vaccineCatalogId_fkey" FOREIGN KEY ("vaccineCatalogId") REFERENCES "VaccineCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingEvent" ADD CONSTRAINT "BreedingEvent_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingEvent" ADD CONSTRAINT "BreedingEvent_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingEvent" ADD CONSTRAINT "BreedingEvent_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalvingRecord" ADD CONSTRAINT "CalvingRecord_breedingEventId_fkey" FOREIGN KEY ("breedingEventId") REFERENCES "BreedingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalvingRecord" ADD CONSTRAINT "CalvingRecord_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalvingRecord" ADD CONSTRAINT "CalvingRecord_calfId_fkey" FOREIGN KEY ("calfId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_fromCampId_fkey" FOREIGN KEY ("fromCampId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_toCampId_fkey" FOREIGN KEY ("toCampId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeathRecord" ADD CONSTRAINT "DeathRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeathRecord" ADD CONSTRAINT "DeathRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineInventory" ADD CONSTRAINT "MedicineInventory_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RainfallLog" ADD CONSTRAINT "RainfallLog_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

