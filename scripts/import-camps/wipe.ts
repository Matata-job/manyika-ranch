import { PrismaClient } from "@prisma/client";

const KEEP_EMAILS = new Set([
  "owner@manyikaranch.co.tz",
  "manager@manyikaranch.co.tz",
  "vet@manyikaranch.co.tz",
  "owner@yabuu.co.tz",
  "manager@yabuu.co.tz",
  "vet@yabuu.co.tz",
]);

const KEEP_ROLES = new Set(["OWNER", "FARM_MANAGER", "VETERINARIAN"]);

/**
 * Wipe demo herd data. Keeps ranch + core staff (OWNER / FM / VET).
 */
export async function wipeDemoHerd(prisma: PrismaClient, ranchId: string) {
  const keepUsers = await prisma.user.findMany({
    where: {
      ranchId,
      OR: [
        { email: { in: [...KEEP_EMAILS] } },
        { role: { in: [...KEEP_ROLES] as ("OWNER" | "FARM_MANAGER" | "VETERINARIAN")[] } },
      ],
    },
    select: { id: true, email: true },
  });
  const keepIds = keepUsers.map((u) => u.id);
  const campIds = (
    await prisma.camp.findMany({ where: { ranchId }, select: { id: true } })
  ).map((c) => c.id);
  const animalIds = (
    await prisma.animal.findMany({
      where: { campId: { in: campIds } },
      select: { id: true },
    })
  ).map((a) => a.id);

  if (animalIds.length) {
    await prisma.animalEvent.deleteMany({ where: { animalId: { in: animalIds } } });
    await prisma.animalPhoto.deleteMany({ where: { animalId: { in: animalIds } } });
    await prisma.weightLog.deleteMany({ where: { animalId: { in: animalIds } } });
    await prisma.healthRecord.deleteMany({ where: { animalId: { in: animalIds } } });
    await prisma.vaccination.deleteMany({ where: { animalId: { in: animalIds } } });
    await prisma.treatment.deleteMany({ where: { animalId: { in: animalIds } } });
    await prisma.sale.deleteMany({ where: { animalId: { in: animalIds } } });
    await prisma.deathRecord.deleteMany({ where: { animalId: { in: animalIds } } });
    await prisma.ownershipTransfer.deleteMany({
      where: { animalId: { in: animalIds } },
    });
    await prisma.alert.deleteMany({ where: { animalId: { in: animalIds } } });
    await prisma.calvingRecord.deleteMany({
      where: {
        OR: [{ damId: { in: animalIds } }, { calfId: { in: animalIds } }],
      },
    });
    await prisma.breedingEvent.deleteMany({
      where: {
        OR: [{ damId: { in: animalIds } }, { sireId: { in: animalIds } }],
      },
    });
    await prisma.animal.updateMany({
      where: { id: { in: animalIds } },
      data: { sireId: null, damId: null },
    });
    await prisma.animal.deleteMany({ where: { id: { in: animalIds } } });
  }

  if (campIds.length) {
    await prisma.movement.deleteMany({
      where: {
        OR: [{ fromCampId: { in: campIds } }, { toCampId: { in: campIds } }],
      },
    });
    for (const [label, fn] of [
      ["campPhoto", () => prisma.campPhoto.deleteMany({ where: { campId: { in: campIds } } })],
      [
        "userCampAssignment",
        () => prisma.userCampAssignment.deleteMany({ where: { campId: { in: campIds } } }),
      ],
      [
        "medicineInventory",
        () => prisma.medicineInventory.deleteMany({ where: { campId: { in: campIds } } }),
      ],
      ["rainfallLog", () => prisma.rainfallLog.deleteMany({ where: { campId: { in: campIds } } })],
    ] as const) {
      try {
        await fn();
      } catch (e) {
        console.warn(`wipe skip ${label}:`, (e as Error).message?.slice(0, 80));
      }
    }
    await prisma.camp.deleteMany({ where: { id: { in: campIds } } });
  }

  const extras = await prisma.user.findMany({
    where: { ranchId, id: { notIn: keepIds } },
    select: { id: true },
  });
  for (const u of extras) {
    await prisma.auditLog.deleteMany({ where: { userId: u.id } });
    try {
      await prisma.user.delete({ where: { id: u.id } });
    } catch {
      await prisma.user.update({
        where: { id: u.id },
        data: { isActive: false },
      });
    }
  }

  return {
    campsRemoved: campIds.length,
    animalsRemoved: animalIds.length,
    keptUsers: keepIds.length,
    extraUsers: extras.length,
  };
}
