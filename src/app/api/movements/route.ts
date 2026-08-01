import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  buildAnimalScope,
  buildMovementScope,
} from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { logAnimalEvent } from "@/lib/services/event-service";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("manageMovements");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const movementScope = await buildMovementScope(
    result.user.id,
    result.user.role as Role
  );
  if ("error" in movementScope) return movementScope.error;

  const dateFilter =
    from || to
      ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {};

  const campFilter =
    campId && campId !== "all"
      ? {
          OR: [
            { fromCampId: campId },
            { toCampId: campId },
          ],
        }
      : {};

  const movements = await prisma.movement.findMany({
    where: {
      AND: [movementScope, dateFilter, campFilter],
    },
    orderBy: { date: "desc" },
    take: 200,
    include: {
      animal: {
        select: {
          id: true,
          eartag: true,
          breed: true,
          camp: { select: { id: true, name: true } },
        },
      },
      fromCamp: { select: { id: true, name: true } },
      toCamp: { select: { id: true, name: true } },
      authorizedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(movements);
}

/**
 * Bulk camp transfer. Body: { animalIds, toCampId, date?, reason? }
 */
export async function POST(req: NextRequest) {
  const result = await requirePermission("manageMovements");
  if (!result.ok) return result.error;

  const body = await req.json();
  const toCampId =
    typeof body.toCampId === "string" ? body.toCampId.trim() : "";
  if (!toCampId) {
    return NextResponse.json({ error: "toCampId is required" }, { status: 400 });
  }

  const animalIds: string[] = Array.isArray(body.animalIds)
    ? [
        ...new Set(
          (body.animalIds as unknown[]).filter(
            (id): id is string => typeof id === "string" && id.length > 0
          )
        ),
      ]
    : [];

  if (animalIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one animal" },
      { status: 400 }
    );
  }
  if (animalIds.length > 500) {
    return NextResponse.json(
      { error: "Maximum 500 animals per bulk move" },
      { status: 400 }
    );
  }

  const toCamp = await prisma.camp.findFirst({
    where: { id: toCampId, ranchId: result.user.ranchId },
    select: { id: true, name: true },
  });
  if (!toCamp) {
    return NextResponse.json(
      { error: "Destination camp not found" },
      { status: 404 }
    );
  }

  const scope = await buildAnimalScope(
    result.user.id,
    result.user.role as Role
  );
  if ("error" in scope) return scope.error;

  const animals = await prisma.animal.findMany({
    where: {
      id: { in: animalIds },
      ...scope,
    },
    select: {
      id: true,
      eartag: true,
      campId: true,
      status: true,
      camp: { select: { id: true, name: true } },
    },
  });

  const foundIds = new Set(animals.map((a) => a.id));
  const date = body.date ? new Date(body.date) : new Date();
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "Camp transfer";

  let moved = 0;
  let skipped = 0;
  const errors: { eartag?: string; id: string; error: string }[] = [];

  for (const id of animalIds) {
    if (!foundIds.has(id)) {
      skipped += 1;
      errors.push({ id, error: "Not found or inaccessible" });
      continue;
    }
  }

  for (const animal of animals) {
    if (animal.status === "DECEASED" || animal.status === "SOLD") {
      skipped += 1;
      errors.push({
        id: animal.id,
        eartag: animal.eartag,
        error: `Cannot move ${animal.status.toLowerCase()} animal`,
      });
      continue;
    }
    if (animal.campId === toCampId) {
      skipped += 1;
      errors.push({
        id: animal.id,
        eartag: animal.eartag,
        error: "Already in destination camp",
      });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.movement.create({
          data: {
            animalId: animal.id,
            fromCampId: animal.campId,
            toCampId,
            date,
            reason,
            authorizedById: result.user.id,
          },
        });
        await tx.animal.update({
          where: { id: animal.id },
          data: { campId: toCampId },
        });
      });

      await logAnimalEvent({
        animalId: animal.id,
        type: "MOVEMENT",
        title: `Moved ${animal.camp.name} → ${toCamp.name}`,
        description: reason,
        occurredAt: date,
        recordedById: result.user.id,
        metadata: {
          fromCampId: animal.campId,
          toCampId,
          bulk: true,
        },
      });

      await createAuditLog(result.user.id, "MOVE", "Animal", animal.id, {
        fromCampId: animal.campId,
        toCampId,
        bulk: true,
      });

      moved += 1;
    } catch (e) {
      skipped += 1;
      errors.push({
        id: animal.id,
        eartag: animal.eartag,
        error: e instanceof Error ? e.message : "Move failed",
      });
    }
  }

  return NextResponse.json({
    moved,
    skipped,
    toCamp: toCamp.name,
    errors: errors.slice(0, 50),
  });
}
