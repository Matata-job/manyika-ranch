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
  const PLANNING_KEYS = new Set(["herdPlan", "herdPlanNote"]);
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

  if (body.rfidChip !== undefined) {
    const rfidChip =
      body.rfidChip === null || body.rfidChip === ""
        ? null
        : String(body.rfidChip).trim() || null;
    body.rfidChip = rfidChip;
    if (rfidChip) {
      const rfidTaken = await prisma.animal.findFirst({
        where: { rfidChip, NOT: { id } },
        select: { id: true },
      });
      if (rfidTaken) {
        return NextResponse.json(
          { error: "RFID chip already registered to another animal" },
          { status: 409 }
        );
      }
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
      herdPlan: true,
      herdPlanNote: true,
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

  const { isHerdPlan } = await import("@/lib/herd-plan");
  let nextHerdPlan: "EXCLUDED" | "KEEP_BREEDING" | "SELL_NEXT_CYCLE" | undefined;
  let nextHerdPlanNote: string | null | undefined;
  let nextHerdPlanAt: Date | null | undefined;

  if (body.herdPlan !== undefined) {
    if (previous && (previous.status === "SOLD" || previous.status === "DECEASED")) {
      return NextResponse.json(
        { error: "Cannot change herd plan on a sold or deceased animal" },
        { status: 400 }
      );
    }
    if (!isHerdPlan(body.herdPlan)) {
      return NextResponse.json(
        { error: "Invalid herd plan (EXCLUDED, KEEP_BREEDING, or SELL_NEXT_CYCLE)" },
        { status: 400 }
      );
    }
    nextHerdPlan = body.herdPlan;
    if (nextHerdPlan === "EXCLUDED") {
      nextHerdPlanAt = null;
      nextHerdPlanNote = null;
    } else if (nextHerdPlan !== previous?.herdPlan) {
      nextHerdPlanAt = new Date();
    }
  }

  if (body.herdPlanNote !== undefined) {
    nextHerdPlanNote =
      body.herdPlanNote === null || body.herdPlanNote === ""
        ? null
        : String(body.herdPlanNote).trim();
    if (nextHerdPlan === "EXCLUDED" || previous?.herdPlan === "EXCLUDED") {
      // notes only apply when a plan is active
      if ((nextHerdPlan ?? previous?.herdPlan) === "EXCLUDED") {
        nextHerdPlanNote = null;
      }
    }
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
      herdPlan: nextHerdPlan,
      herdPlanNote: nextHerdPlanNote,
      herdPlanAt: nextHerdPlanAt,
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
    const reason =
      typeof body.statusReason === "string" && body.statusReason.trim()
        ? body.statusReason.trim()
        : null;
    const to = String(body.status);
    const from = previous.status;
    let type: "QUARANTINE" | "STATUS_CHANGE" = "STATUS_CHANGE";
    let title = `Status: ${from} → ${to}`;
    if (to === "QUARANTINE") {
      type = "QUARANTINE";
      title = "Marked quarantine";
    } else if (to === "MISSING") {
      title = "Marked missing";
    } else if (to === "ACTIVE" && (from === "QUARANTINE" || from === "MISSING")) {
      title =
        from === "QUARANTINE"
          ? "Released from quarantine (active)"
          : "Found / returned to active";
    }
    await logAnimalEvent({
      animalId: id,
      type,
      title,
      description: reason,
      recordedById: result.user.id,
      metadata: { from, to, reason },
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
    nextHerdPlan !== undefined &&
    nextHerdPlan !== previous.herdPlan
  ) {
    const titles: Record<string, string> = {
      EXCLUDED: "Herd plan cleared (excluded)",
      KEEP_BREEDING: "Marked keep for breeding",
      SELL_NEXT_CYCLE: "Marked sell next cycle",
    };
    await logAnimalEvent({
      animalId: id,
      type: "STATUS_CHANGE",
      title: titles[nextHerdPlan] || "Herd plan updated",
      description: animal.herdPlanNote || undefined,
      recordedById: result.user.id,
      metadata: {
        herdPlan: nextHerdPlan,
        herdPlanNote: animal.herdPlanNote,
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
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("deleteAnimal");
  if (!result.ok) return result.error;

  const animal = await prisma.animal.findUnique({
    where: { id },
    select: { eartag: true, status: true, camp: { select: { name: true, code: true } } },
  });
  if (!animal) {
    return NextResponse.json({ error: "Animal not found" }, { status: 404 });
  }

  await prisma.animal.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: result.user.id,
    },
  });

  await createAuditLog(result.user.id, "DELETE", "Animal", id, {
    soft: true,
    eartag: animal.eartag,
    status: animal.status,
    campName: animal.camp?.name ?? null,
    campCode: animal.camp?.code ?? null,
  });
  return NextResponse.json({ success: true, softDeleted: true });
}
