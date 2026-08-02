import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  requireAnimalAccess,
} from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { logAnimalEvent } from "@/lib/services/event-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const record = await prisma.deathRecord.findUnique({
    where: { animalId: id },
    include: { recordedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(record);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const animal = await prisma.animal.findUnique({
    where: { id },
    select: { id: true, eartag: true, status: true },
  });
  if (!animal) {
    return NextResponse.json({ error: "Animal not found" }, { status: 404 });
  }
  if (animal.status === "DECEASED") {
    return NextResponse.json(
      { error: "Animal already marked deceased" },
      { status: 409 }
    );
  }

  const existing = await prisma.deathRecord.findUnique({ where: { animalId: id } });
  if (existing) {
    return NextResponse.json({ error: "Death record already exists" }, { status: 409 });
  }

  const body = await req.json();
  const photoUrl =
    typeof body.photoUrl === "string" && body.photoUrl.trim()
      ? body.photoUrl.trim()
      : null;

  const date = body.date ? new Date(body.date) : new Date();
  const isCulling = Boolean(body.isCulling) || body.cause === "CULLING";

  const record = await prisma.$transaction(async (tx) => {
    const death = await tx.deathRecord.create({
      data: {
        animalId: id,
        date,
        cause: body.cause || "UNKNOWN",
        causeDetail: body.causeDetail,
        disposalMethod: body.disposalMethod || "BURIED",
        disposalNotes: body.disposalNotes,
        location: body.location,
        weightKg: body.weightKg ? parseFloat(body.weightKg) : null,
        photoUrl,
        insuranceClaim: Boolean(body.insuranceClaim),
        claimAmountTzs: body.claimAmountTzs ? parseFloat(body.claimAmountTzs) : null,
        claimReference: body.claimReference,
        isCulling,
        recordedById: result.user.id,
        notes: body.notes,
      },
      include: { recordedBy: { select: { id: true, name: true } } },
    });

    if (photoUrl) {
      await tx.animalPhoto.create({
        data: {
          animalId: id,
          url: photoUrl,
          caption: "Death evidence — eartag visible",
          takenAt: date,
          uploadedById: result.user.id,
        },
      });
    }

    await tx.animal.update({
      where: { id },
      data: {
        status: "DECEASED",
        herdPlan: "EXCLUDED",
        herdPlanNote: null,
        herdPlanAt: null,
        ...(photoUrl ? { photoUrl } : {}),
      },
    });

    return death;
  });

  await logAnimalEvent({
    animalId: id,
    type: isCulling ? "CULLING" : "DEATH",
    title: isCulling
      ? `Culled: ${animal.eartag}`
      : `Death recorded: ${animal.eartag}`,
    description: [
      `Cause: ${record.cause}`,
      record.causeDetail,
      `Disposal: ${record.disposalMethod}`,
      photoUrl ? "Photo with eartag attached" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    occurredAt: date,
    recordedById: result.user.id,
    metadata: {
      cause: record.cause,
      disposalMethod: record.disposalMethod,
      insuranceClaim: record.insuranceClaim,
      isCulling,
      photoUrl,
    },
  });

  await createAuditLog(result.user.id, "DEATH", "Animal", id, {
    cause: record.cause,
    isCulling,
    photoUrl,
  });

  return NextResponse.json(record, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("editMortality");
  if (!result.ok) return result.error;

  const existing = await prisma.deathRecord.findUnique({ where: { animalId: id } });
  if (!existing) {
    return NextResponse.json({ error: "Death record not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.date !== undefined) data.date = body.date ? new Date(body.date) : existing.date;
  if (body.cause !== undefined) data.cause = body.cause;
  if (body.causeDetail !== undefined) data.causeDetail = body.causeDetail || null;
  if (body.disposalMethod !== undefined) data.disposalMethod = body.disposalMethod;
  if (body.disposalNotes !== undefined) data.disposalNotes = body.disposalNotes || null;
  if (body.location !== undefined) data.location = body.location || null;
  if (body.weightKg !== undefined) {
    data.weightKg =
      body.weightKg === null || body.weightKg === ""
        ? null
        : parseFloat(String(body.weightKg));
  }
  if (body.insuranceClaim !== undefined) data.insuranceClaim = Boolean(body.insuranceClaim);
  if (body.claimAmountTzs !== undefined) {
    data.claimAmountTzs =
      body.claimAmountTzs === null || body.claimAmountTzs === ""
        ? null
        : parseFloat(String(body.claimAmountTzs));
  }
  if (body.claimReference !== undefined) data.claimReference = body.claimReference || null;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.isCulling !== undefined) {
    data.isCulling = Boolean(body.isCulling) || body.cause === "CULLING";
  } else if (body.cause === "CULLING") {
    data.isCulling = true;
  }

  const nextPhoto =
    typeof body.photoUrl === "string" ? body.photoUrl.trim() : undefined;
  if (nextPhoto !== undefined) {
    data.photoUrl = nextPhoto || null;
  }

  const record = await prisma.$transaction(async (tx) => {
    const death = await tx.deathRecord.update({
      where: { animalId: id },
      data,
      include: { recordedBy: { select: { id: true, name: true } } },
    });

    if (nextPhoto && nextPhoto !== existing.photoUrl) {
      await tx.animalPhoto.create({
        data: {
          animalId: id,
          url: nextPhoto,
          caption: "Death evidence — eartag visible (updated)",
          takenAt: death.date,
          uploadedById: result.user.id,
        },
      });
      await tx.animal.update({
        where: { id },
        data: { photoUrl: nextPhoto },
      });
    }

    return death;
  });

  await createAuditLog(result.user.id, "UPDATE", "DeathRecord", record.id, data);

  return NextResponse.json(record);
}
