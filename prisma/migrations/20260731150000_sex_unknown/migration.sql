-- AlterEnum
DO $$ BEGIN
  ALTER TYPE "Sex" ADD VALUE 'UNKNOWN';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
