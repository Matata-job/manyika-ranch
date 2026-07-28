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

export async function checkVaccinationAlerts() {
  const dueVaccinations = await prisma.vaccination.findMany({
    where: {
      nextDue: { lte: new Date() },
      animal: { status: "ACTIVE" },
    },
    include: { animal: { select: { id: true, eartag: true } } },
  });

  for (const v of dueVaccinations) {
    const existing = await prisma.alert.findFirst({
      where: {
        type: "VACCINATION_DUE",
        animalId: v.animalId,
        status: "PENDING",
      },
    });
    if (!existing) {
      await prisma.alert.create({
        data: {
          type: "VACCINATION_DUE",
          title: `Vaccination due: ${v.animal.eartag}`,
          message: `${v.vaccineName} is due for animal ${v.animal.eartag}`,
          animalId: v.animalId,
          dueDate: v.nextDue,
        },
      });
    }
  }
}
