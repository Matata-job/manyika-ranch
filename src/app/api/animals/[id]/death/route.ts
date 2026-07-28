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
        insuranceClaim: Boolean(body.insuranceClaim),
        claimAmountTzs: body.claimAmountTzs ? parseFloat(body.claimAmountTzs) : null,
        claimReference: body.claimReference,
        isCulling,
        recordedById: result.user.id,
        notes: body.notes,
      },
      include: { recordedBy: { select: { id: true, name: true } } },
    });

    await tx.animal.update({
      where: { id },
      data: { status: "DECEASED" },
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
    },
  });

  await createAuditLog(result.user.id, "DEATH", "Animal", id, {
    cause: record.cause,
    isCulling,
  });

  return NextResponse.json(record, { status: 201 });
}
