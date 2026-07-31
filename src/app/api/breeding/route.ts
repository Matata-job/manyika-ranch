import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  buildAnimalScope,
  requireAnimalAccess,
} from "@/lib/auth/api-guard";
import { logAnimalEvent } from "@/lib/services/event-service";
import type { Role } from "@prisma/client";

export async function GET() {
  const result = await requirePermission("manageBreeding");
  if (!result.ok) return result.error;

  const animalScope = await buildAnimalScope(
    result.user.id,
    result.user.role as Role
  );
  if ("error" in animalScope) return animalScope.error;

  const events = await prisma.breedingEvent.findMany({
    where: { dam: animalScope },
    orderBy: { matingDate: "desc" },
    take: 100,
    include: {
      dam: { select: { id: true, eartag: true, isPregnant: true } },
      sire: { select: { id: true, eartag: true } },
      calving: { include: { calf: { select: { id: true, eartag: true } } } },
      recordedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageBreeding");
  if (!result.ok) return result.error;

  const body = await req.json();

  const damAccess = await requireAnimalAccess(body.damId);
  if (!damAccess.ok) return damAccess.error;

  if (body.sireId) {
    const sireAccess = await requireAnimalAccess(body.sireId);
    if (!sireAccess.ok) return sireAccess.error;
  }

  const pregnancyConfirmed = Boolean(body.pregnancyConfirmed);
  const event = await prisma.breedingEvent.create({
    data: {
      damId: body.damId,
      sireId: body.sireId || null,
      matingDate: new Date(body.matingDate),
      method: body.method || "NATURAL",
      pregnancyConfirmed,
      recordedById: result.user.id,
      notes: body.notes,
    },
    include: {
      dam: { select: { id: true, eartag: true } },
      sire: { select: { id: true, eartag: true } },
    },
  });

  await logAnimalEvent({
    animalId: body.damId,
    type: "BREEDING",
    title: event.sire
      ? `Mated with ${event.sire.eartag}`
      : "Mating recorded",
    description: `${event.method} · ${new Date(body.matingDate).toISOString().slice(0, 10)}`,
    occurredAt: new Date(body.matingDate),
    recordedById: result.user.id,
    metadata: {
      breedingEventId: event.id,
      sireId: body.sireId || null,
      method: event.method,
    },
  });

  if (pregnancyConfirmed) {
    await prisma.animal.update({
      where: { id: body.damId },
      data: { isPregnant: true },
    });
    await logAnimalEvent({
      animalId: body.damId,
      type: "STATUS_CHANGE",
      title: "Marked pregnant",
      description: "Pregnancy confirmed from breeding record",
      recordedById: result.user.id,
      metadata: { isPregnant: true, breedingEventId: event.id },
    });
  }

  return NextResponse.json(event, { status: 201 });
}
