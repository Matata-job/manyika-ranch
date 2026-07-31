-- AlterEnum
DO $$ BEGIN
  ALTER TYPE "AnimalEventType" ADD VALUE 'CASTRATION';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
