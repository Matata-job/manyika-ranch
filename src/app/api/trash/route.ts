import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import {
  daysLeftInTrash,
  getTrashRetentionDays,
  isTrashExpired,
} from "@/lib/trash";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";

async function retentionDaysForRanch(ranchId: string) {
  const ranch = await prisma.ranch.findUnique({
    where: { id: ranchId },
    select: { settings: true },
  });
  return getTrashRetentionDays(ranch?.settings);
}

/** List soft-deleted animals and camps; purge anything past retention. */
export async function GET() {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const canManageCamps = hasPermission(
    result.user.role as Role,
    "manageCamps"
  );
  const canDeleteAnimal = hasPermission(
    result.user.role as Role,
    "deleteAnimal"
  );
  if (!canManageCamps && !canDeleteAnimal) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const retentionDays = await retentionDaysForRanch(result.user.ranchId);
  const now = new Date();

  const camps = canManageCamps
    ? await prisma.camp.findMany({
        where: {
          ranchId: result.user.ranchId,
          deletedAt: { not: null },
        },
        orderBy: { deletedAt: "desc" },
      })
    : [];

  const animals = canDeleteAnimal
    ? await prisma.animal.findMany({
        where: {
          deletedAt: { not: null },
          camp: { ranchId: result.user.ranchId },
        },
        include: {
          camp: { select: { id: true, name: true } },
        },
        orderBy: { deletedAt: "desc" },
      })
    : [];

  const expiredCampIds = camps
    .filter((c) => c.deletedAt && isTrashExpired(c.deletedAt, retentionDays, now))
    .map((c) => c.id);
  const expiredAnimalIds = animals
    .filter((a) => a.deletedAt && isTrashExpired(a.deletedAt, retentionDays, now))
    .map((a) => a.id);

  if (expiredAnimalIds.length) {
    await prisma.animal.deleteMany({ where: { id: { in: expiredAnimalIds } } });
  }
  if (expiredCampIds.length) {
    await prisma.animal.deleteMany({
      where: { campId: { in: expiredCampIds } },
    });
    await prisma.camp.deleteMany({ where: { id: { in: expiredCampIds } } });
  }

  const liveCamps = camps.filter((c) => !expiredCampIds.includes(c.id));
  const liveAnimals = animals.filter((a) => !expiredAnimalIds.includes(a.id));

  return NextResponse.json({
    retentionDays,
    purged: {
      animals: expiredAnimalIds.length,
      camps: expiredCampIds.length,
    },
    animals: liveAnimals.map((a) => ({
      id: a.id,
      eartag: a.eartag,
      breed: a.breed,
      sex: a.sex,
      status: a.status,
      campName: a.camp.name,
      deletedAt: a.deletedAt,
      daysLeft: a.deletedAt
        ? daysLeftInTrash(a.deletedAt, retentionDays, now)
        : 0,
    })),
    camps: liveCamps.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      deletedAt: c.deletedAt,
      daysLeft: c.deletedAt
        ? daysLeftInTrash(c.deletedAt, retentionDays, now)
        : 0,
    })),
  });
}

/** Permanently delete a trash item early. */
export async function DELETE(req: NextRequest) {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  if (!type || !id || !["animal", "camp"].includes(type)) {
    return NextResponse.json(
      { error: "type (animal|camp) and id are required" },
      { status: 400 }
    );
  }

  if (type === "animal") {
    const perm = await requirePermission("deleteAnimal");
    if (!perm.ok) return perm.error;
    const animal = await prisma.animal.findFirst({
      where: {
        id,
        deletedAt: { not: null },
        camp: { ranchId: result.user.ranchId },
      },
    });
    if (!animal) {
      return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
    }
    await prisma.animal.delete({ where: { id } });
    await createAuditLog(result.user.id, "DELETE", "Animal", id, {
      permanent: true,
      eartag: animal.eartag,
      status: animal.status,
    });
    return NextResponse.json({ success: true });
  }

  const perm = await requirePermission("manageCamps");
  if (!perm.ok) return perm.error;
  const camp = await prisma.camp.findFirst({
    where: {
      id,
      ranchId: result.user.ranchId,
      deletedAt: { not: null },
    },
  });
  if (!camp) {
    return NextResponse.json({ error: "Not found in trash" }, { status: 404 });
  }
  await prisma.animal.deleteMany({ where: { campId: id } });
  await prisma.camp.delete({ where: { id } });
  await createAuditLog(result.user.id, "DELETE", "Camp", id, {
    permanent: true,
    name: camp.name,
    code: camp.code,
  });
  return NextResponse.json({ success: true });
}
