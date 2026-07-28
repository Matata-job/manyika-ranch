import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  requireAnimalAccess,
} from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { logAnimalEvent } from "@/lib/services/event-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Must have access to the animal (i.e. its current camp)
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;
  const animal = access.animal;

  const result = await requirePermission("manageMovements");
  if (!result.ok) return result.error;

  const body = await req.json();
  if (!body.toCampId) {
    return NextResponse.json({ error: "toCampId is required" }, { status: 400 });
  }

  if (body.toCampId === animal.campId) {
    return NextResponse.json(
      { error: "Animal is already in that camp" },
      { status: 400 }
    );
  }

  // Destination can be any camp on the same ranch (supervisor may move animals out)
  const [fromCamp, toCamp] = await Promise.all([
    prisma.camp.findUnique({ where: { id: animal.campId }, select: { id: true, name: true } }),
    prisma.camp.findFirst({
      where: { id: body.toCampId, ranchId: result.user.ranchId },
      select: { id: true, name: true },
    }),
  ]);
  if (!toCamp) {
    return NextResponse.json({ error: "Destination camp not found" }, { status: 404 });
  }

  const movement = await prisma.movement.create({
    data: {
      animalId: id,
      fromCampId: animal.campId,
      toCampId: body.toCampId,
      date: body.date ? new Date(body.date) : new Date(),
      reason: body.reason,
      authorizedById: result.user.id,
    },
  });

  await prisma.animal.update({
    where: { id },
    data: { campId: body.toCampId },
  });

  await logAnimalEvent({
    animalId: id,
    type: "MOVEMENT",
    title: `Moved ${fromCamp?.name || "camp"} → ${toCamp.name}`,
    description: body.reason || undefined,
    occurredAt: movement.date,
    recordedById: result.user.id,
    metadata: { fromCampId: animal.campId, toCampId: body.toCampId },
  });

  await createAuditLog(result.user.id, "MOVE", "Animal", id, {
    fromCampId: animal.campId,
    toCampId: body.toCampId,
  });

  return NextResponse.json(movement, { status: 201 });
}
