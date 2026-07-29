import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  requireAnimalAccess,
  requireCampAccess,
} from "@/lib/auth/api-guard";
import { createAuditLog, withComputedAge, updateAnimalAgeMonths } from "@/lib/services/animal-service";
import { computeAgeMonths } from "@/lib/utils";
import { logAnimalEvent } from "@/lib/services/event-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const perm = await requirePermission("viewAnimal");
  if (!perm.ok) return perm.error;

  const animal = await prisma.animal.findUnique({
    where: { id },
    include: {
      camp: true,
      owner: { select: { id: true, name: true, email: true } },
      sire: { select: { id: true, eartag: true, breed: true } },
      dam: { select: { id: true, eartag: true, breed: true } },
      weightLogs: {
        orderBy: { date: "desc" },
        take: 20,
        include: { recordedBy: { select: { name: true } } },
      },
      healthRecords: { orderBy: { date: "desc" }, take: 20 },
      vaccinations: { orderBy: { date: "desc" }, take: 20 },
      treatments: { orderBy: { date: "desc" }, take: 20 },
      movements: {
        orderBy: { date: "desc" },
        take: 10,
        include: {
          fromCamp: true,
          toCamp: true,
          authorizedBy: { select: { name: true } },
        },
      },
      ownershipTransfers: { orderBy: { date: "desc" }, take: 10 },
      breedingEventsAsDam: {
        orderBy: { matingDate: "desc" },
        include: { sire: { select: { eartag: true } } },
      },
      calvingAsDam: {
        orderBy: { date: "desc" },
        include: { calf: { select: { id: true, eartag: true } } },
      },
      deathRecord: {
        include: { recordedBy: { select: { id: true, name: true } } },
      },
      events: {
        orderBy: { occurredAt: "desc" },
        take: 50,
        include: { recordedBy: { select: { id: true, name: true } } },
      },
      photos: {
        orderBy: { takenAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });

  if (!animal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(withComputedAge(animal));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;
  const currentCampId = access.animal.campId;

  const result = await requirePermission("editAnimal");
  if (!result.ok) return result.error;

  const body = await req.json();
  const dob = body.dob ? new Date(body.dob) : undefined;

  if (body.campId && body.campId !== currentCampId) {
    const campAccess = await requireCampAccess(body.campId);
    if (!campAccess.ok) return campAccess.error;
  }

  if (body.eartag) {
    const existing = await prisma.animal.findFirst({
      where: { eartag: body.eartag, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Eartag already exists" }, { status: 409 });
    }
  }

  const previous = await prisma.animal.findUnique({
    where: { id },
    select: { status: true },
  });

  const animal = await prisma.animal.update({
    where: { id },
    data: {
      eartag: body.eartag,
      rfidChip: body.rfidChip,
      photoUrl: body.photoUrl,
      breed: body.breed,
      sex: body.sex,
      dob,
      ageMonths: dob ? computeAgeMonths(dob) : undefined,
      ownerId: body.ownerId,
      sireId: body.sireId,
      damId: body.damId,
      campId: body.campId,
      status: body.status,
      acquisitionType: body.acquisitionType,
      acquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : undefined,
      colorMarkings: body.colorMarkings,
      notes: body.notes,
    },
  });

  if (dob) await updateAnimalAgeMonths(id, dob);

  if (body.status && previous && body.status !== previous.status) {
    await logAnimalEvent({
      animalId: id,
      type: body.status === "QUARANTINE" ? "QUARANTINE" : "STATUS_CHANGE",
      title: `Status: ${previous.status} → ${body.status}`,
      recordedById: result.user.id,
      metadata: { from: previous.status, to: body.status },
    });
  }

  await createAuditLog(result.user.id, "UPDATE", "Animal", id, body);
  return NextResponse.json(withComputedAge(animal));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      error:
        "Use POST /api/animals/:id/death to record mortality with cause and disposal details",
    },
    { status: 400 }
  );
}
