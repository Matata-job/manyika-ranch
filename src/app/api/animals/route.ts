import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  requireCampAccess,
  buildAnimalScope,
} from "@/lib/auth/api-guard";
import { createAuditLog, withComputedAge } from "@/lib/services/animal-service";
import { computeAgeMonths } from "@/lib/utils";
import { logAnimalEvent } from "@/lib/services/event-service";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewAnimal");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");
  const ownerId = searchParams.get("owner");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const scope = await buildAnimalScope(result.user.id, result.user.role as Role, {
    campId,
  });
  if ("error" in scope) return scope.error;

  const animals = await prisma.animal.findMany({
    where: {
      ...scope,
      ...(ownerId && result.user.role !== "EXTERNAL_OWNER" ? { ownerId } : {}),
      ...(status ? { status: status as "ACTIVE" } : {}),
      ...(search
        ? {
            OR: [
              { eartag: { contains: search, mode: "insensitive" } },
              { breed: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      camp: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      sire: { select: { id: true, eartag: true } },
      dam: { select: { id: true, eartag: true } },
    },
    orderBy: { eartag: "asc" },
    take: 200,
  });

  return NextResponse.json(animals.map(withComputedAge));
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("createAnimal");
  if (!result.ok) return result.error;

  const body = await req.json();
  if (!body.campId) {
    return NextResponse.json({ error: "campId is required" }, { status: 400 });
  }

  const campAccess = await requireCampAccess(body.campId);
  if (!campAccess.ok) return campAccess.error;

  const dob = body.dob ? new Date(body.dob) : null;

  const existing = await prisma.animal.findUnique({ where: { eartag: body.eartag } });
  if (existing) {
    return NextResponse.json({ error: "Eartag already exists" }, { status: 409 });
  }

  const animal = await prisma.animal.create({
    data: {
      eartag: body.eartag,
      rfidChip: body.rfidChip,
      photoUrl: body.photoUrl,
      breed: body.breed,
      sex: body.sex,
      dob,
      ageMonths: dob ? computeAgeMonths(dob) : null,
      ownerId: body.ownerId || result.user.id,
      sireId: body.sireId || null,
      damId: body.damId || null,
      campId: body.campId,
      status: body.status || "ACTIVE",
      acquisitionType: body.acquisitionType || "BORN_ON_FARM",
      acquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : null,
      colorMarkings: body.colorMarkings,
      notes: body.notes,
    },
    include: {
      camp: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  });

  await createAuditLog(result.user.id, "CREATE", "Animal", animal.id, { eartag: body.eartag });
  await logAnimalEvent({
    animalId: animal.id,
    type: "REGISTERED",
    title: `Registered ${animal.eartag}`,
    description: `${animal.breed} · ${animal.sex} · Camp ${animal.camp.name}`,
    recordedById: result.user.id,
    metadata: { campId: animal.campId, breed: animal.breed },
  });
  return NextResponse.json(withComputedAge(animal), { status: 201 });
}
