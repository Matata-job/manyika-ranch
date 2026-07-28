import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  buildAnimalScope,
  requireAnimalAccess,
} from "@/lib/auth/api-guard";
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
      dam: { select: { id: true, eartag: true } },
      sire: { select: { id: true, eartag: true } },
      calving: true,
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

  const event = await prisma.breedingEvent.create({
    data: {
      damId: body.damId,
      sireId: body.sireId,
      matingDate: new Date(body.matingDate),
      method: body.method || "NATURAL",
      pregnancyConfirmed: body.pregnancyConfirmed || false,
      recordedById: result.user.id,
      notes: body.notes,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
