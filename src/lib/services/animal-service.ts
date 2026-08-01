import { prisma } from "@/lib/db";
import { computeAgeMonths } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export async function createAuditLog(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes?: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      changes: changes as Prisma.InputJsonValue | undefined,
    },
  });
}

export function withComputedAge<T extends { dob: Date | null; ageMonths?: number | null }>(
  animal: T
): T & { ageMonths: number | null } {
  return {
    ...animal,
    ageMonths: animal.dob ? computeAgeMonths(animal.dob) : animal.ageMonths ?? null,
  };
}

export async function updateAnimalAgeMonths(animalId: string, dob: Date | null) {
  if (!dob) return;
  await prisma.animal.update({
    where: { id: animalId },
    data: { ageMonths: computeAgeMonths(dob) },
  });
}

/** @deprecated Prefer syncHealthDueAlerts from health-schedule */
export { checkVaccinationAlerts, syncHealthDueAlerts } from "@/lib/services/health-schedule";

