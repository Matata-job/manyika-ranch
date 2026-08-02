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
      sales: {
        orderBy: { saleDate: "desc" },
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

  const body = await req.json();
  const PLANNING_KEYS = new Set([
    "keepForBreeding",
    "markedForSale",
    "breedingNote",
    "saleCycleNote",
  ]);
  const bodyKeys = Object.keys(body);
  const isPlanningOnly =
    bodyKeys.length > 0 && bodyKeys.every((k) => PLANNING_KEYS.has(k));

  const result = isPlanningOnly
    ? await requirePermission("updateAnimalRecords")
    : await requirePermission("editAnimal");
  if (!result.ok) return result.error;

  const dob =
    body.dob === null
      ? null
      : body.dob
        ? new Date(body.dob)
        : undefined;

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

  if (body.sireId !== undefined && body.sireId !== null && body.sireId !== "") {
    const sire = await prisma.animal.findFirst({
      where: { id: body.sireId, sex: "MALE" },
      select: { id: true },
    });
    if (!sire) {
      return NextResponse.json(
        { error: "Sire must be a male animal" },
        { status: 400 }
      );
    }
    if (body.sireId === id) {
      return NextResponse.json(
        { error: "Animal cannot be its own sire" },
        { status: 400 }
      );
    }
  }

  if (body.damId !== undefined && body.damId !== null && body.damId !== "") {
    const dam = await prisma.animal.findFirst({
      where: { id: body.damId, sex: "FEMALE" },
      select: { id: true },
    });
    if (!dam) {
      return NextResponse.json(
        { error: "Dam must be a female animal" },
        { status: 400 }
      );
    }
    if (body.damId === id) {
      return NextResponse.json(
        { error: "Animal cannot be its own dam" },
        { status: 400 }
      );
    }
  }

  const previous = await prisma.animal.findUnique({
    where: { id },
    select: {
      status: true,
      isCastrated: true,
      isPregnant: true,
      damId: true,
      eartag: true,
      keepForBreeding: true,
      markedForSale: true,
      breedingNote: true,
      saleCycleNote: true,
    },
  });

  if (
    previous &&
    (previous.status === "SOLD" || previous.status === "DECEASED") &&
    body.status &&
    body.status !== previous.status
  ) {
    return NextResponse.json(
      {
        error: `Cannot change status of a ${previous.status.toLowerCase()} animal. Use ownership or records corrections carefully.`,
      },
      { status: 400 }
    );
  }

  // Planning flags: mutual exclusion (keep for breeding vs next sale cycle)
  let nextKeepForBreeding: boolean | undefined;
  let nextMarkedForSale: boolean | undefined;
  let nextBreedingNote: string | null | undefined;
  let nextSaleCycleNote: string | null | undefined;
  let nextKeepForBreedingAt: Date | null | undefined;
  let nextMarkedForSaleAt: Date | null | undefined;

  if (body.keepForBreeding !== undefined || body.markedForSale !== undefined) {
    if (previous && (previous.status === "SOLD" || previous.status === "DECEASED")) {
      return NextResponse.json(
        { error: "Cannot change planning flags on a sold or deceased animal" },
        { status: 400 }
      );
    }
    nextKeepForBreeding =
      body.keepForBreeding !== undefined
        ? Boolean(body.keepForBreeding)
        : previous?.keepForBreeding;
    nextMarkedForSale =
      body.markedForSale !== undefined
        ? Boolean(body.markedForSale)
        : previous?.markedForSale;

    if (nextKeepForBreeding && nextMarkedForSale) {
      // Last write wins based on which field was sent
      if (body.keepForBreeding === true) nextMarkedForSale = false;
      else if (body.markedForSale === true) nextKeepForBreeding = false;
    }

    if (nextKeepForBreeding && !previous?.keepForBreeding) {
      nextKeepForBreedingAt = new Date();
    } else if (nextKeepForBreeding === false) {
      nextKeepForBreedingAt = null;
      nextBreedingNote = null;
    }

    if (nextMarkedForSale && !previous?.markedForSale) {
      nextMarkedForSaleAt = new Date();
    } else if (nextMarkedForSale === false) {
      nextMarkedForSaleAt = null;
      nextSaleCycleNote = null;
    }
  }

  if (body.breedingNote !== undefined) {
    nextBreedingNote =
      body.breedingNote === null || body.breedingNote === ""
        ? null
        : String(body.breedingNote).trim();
  }
  if (body.saleCycleNote !== undefined) {
    nextSaleCycleNote =
      body.saleCycleNote === null || body.saleCycleNote === ""
        ? null
        : String(body.saleCycleNote).trim();
  }

  const nextSex = body.sex as string | undefined;
  let nextCastrated: boolean | undefined;
  let nextPregnant: boolean | undefined;

  if (nextSex === "MALE") {
    nextCastrated =
      body.isCastrated !== undefined ? Boolean(body.isCastrated) : undefined;
    nextPregnant = false;
  } else if (nextSex === "FEMALE") {
    nextPregnant =
      body.isPregnant !== undefined ? Boolean(body.isPregnant) : undefined;
    nextCastrated = false;
  } else if (nextSex === "UNKNOWN") {
    nextCastrated = false;
    nextPregnant = false;
  } else {
    // Sex unchanged — allow flag-only toggles from animal detail
    if (body.isCastrated !== undefined) {
      nextCastrated = Boolean(body.isCastrated);
    }
    if (body.isPregnant !== undefined) {
      nextPregnant = Boolean(body.isPregnant);
    }
  }

  const animal = await prisma.animal.update({
    where: { id },
    data: {
      eartag: body.eartag,
      rfidChip: body.rfidChip,
      photoUrl: body.photoUrl,
      breed: body.breed,
      sex: body.sex,
      isCastrated: nextCastrated,
      isPregnant: nextPregnant,
      keepForBreeding: nextKeepForBreeding,
      markedForSale: nextMarkedForSale,
      breedingNote: nextBreedingNote,
      saleCycleNote: nextSaleCycleNote,
      keepForBreedingAt: nextKeepForBreedingAt,
      markedForSaleAt: nextMarkedForSaleAt,
      dob,
      ageMonths:
        dob instanceof Date
          ? computeAgeMonths(dob)
          : dob === null
            ? body.ageMonths !== undefined
              ? body.ageMonths
              : body.ageYears != null || body.ageMonthsPart != null
                ? Math.max(0, (Number(body.ageYears) || 0) * 12 + (Number(body.ageMonthsPart) || 0))
                : null
            : body.ageMonths !== undefined
              ? body.ageMonths
              : body.ageYears != null || body.ageMonthsPart != null
                ? Math.max(0, (Number(body.ageYears) || 0) * 12 + (Number(body.ageMonthsPart) || 0))
                : undefined,
      ownerId: body.ownerId,
      sireId:
        body.sireId === undefined
          ? undefined
          : body.sireId === null || body.sireId === ""
            ? null
            : body.sireId,
      damId:
        body.damId === undefined
          ? undefined
          : body.damId === null || body.damId === ""
            ? null
            : body.damId,
      campId: body.campId,
      status: body.status,
      acquisitionType: body.acquisitionType,
      acquisitionDate:
        body.acquisitionDate === null || body.acquisitionDate === ""
          ? null
          : body.acquisitionDate
            ? new Date(body.acquisitionDate)
            : undefined,
      colorMarkings: body.colorMarkings,
      tagColor:
        body.tagColor !== undefined
          ? body.tagColor?.trim()
            ? String(body.tagColor).trim().toUpperCase()
            : null
          : undefined,
      notes: body.notes,
    },
  });

  if (dob instanceof Date) await updateAnimalAgeMonths(id, dob);

  if (body.status && previous && body.status !== previous.status) {
    await logAnimalEvent({
      animalId: id,
      type: body.status === "QUARANTINE" ? "QUARANTINE" : "STATUS_CHANGE",
      title: `Status: ${previous.status} → ${body.status}`,
      recordedById: result.user.id,
      metadata: { from: previous.status, to: body.status },
    });
  }

  if (
    previous &&
    nextCastrated === true &&
    previous.isCastrated !== true
  ) {
    await logAnimalEvent({
      animalId: id,
      type: "CASTRATION",
      title: "Castrated",
      description: "Marked as castrated (hasiwa)",
      recordedById: result.user.id,
      metadata: { isCastrated: true },
    });
  }

  if (previous && nextPregnant !== undefined && nextPregnant !== previous.isPregnant) {
    await logAnimalEvent({
      animalId: id,
      type: "STATUS_CHANGE",
      title: nextPregnant ? "Marked pregnant" : "Pregnancy cleared",
      description: nextPregnant
        ? "Expected calf — clear after calving or when confirmed open"
        : "No longer pregnant (open / after calving / breeding season)",
      recordedById: result.user.id,
      metadata: { isPregnant: nextPregnant },
    });
  }

  if (
    previous &&
    nextKeepForBreeding !== undefined &&
    nextKeepForBreeding !== previous.keepForBreeding
  ) {
    await logAnimalEvent({
      animalId: id,
      type: "STATUS_CHANGE",
      title: nextKeepForBreeding
        ? "Marked keep for breeding"
        : "Cleared keep for breeding",
      description: nextBreedingNote || animal.breedingNote || undefined,
      recordedById: result.user.id,
      metadata: {
        keepForBreeding: nextKeepForBreeding,
        breedingNote: animal.breedingNote,
      },
    });
  }

  if (
    previous &&
    nextMarkedForSale !== undefined &&
    nextMarkedForSale !== previous.markedForSale
  ) {
    await logAnimalEvent({
      animalId: id,
      type: "STATUS_CHANGE",
      title: nextMarkedForSale
        ? "Marked for next sale cycle"
        : "Cleared sale-cycle mark",
      description: nextSaleCycleNote || animal.saleCycleNote || undefined,
      recordedById: result.user.id,
      metadata: {
        markedForSale: nextMarkedForSale,
        saleCycleNote: animal.saleCycleNote,
      },
    });
  }

  // Linking a calf to its dam implies the dam has calved — clear pregnancy flag
  if (
    body.damId &&
    typeof body.damId === "string" &&
    body.damId !== previous?.damId
  ) {
    const { clearDamPregnancy } = await import("@/lib/services/breeding-service");
    await clearDamPregnancy(body.damId, {
      recordedById: result.user.id,
      reason: "Calf linked in pedigree",
      calfEartag: animal.eartag,
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
