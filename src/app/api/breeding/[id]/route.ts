import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";
import { logAnimalEvent } from "@/lib/services/event-service";
import { clearDamPregnancy } from "@/lib/services/breeding-service";

/** Confirm pregnancy or mark dam open on a breeding event. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageBreeding");
  if (!result.ok) return result.error;

  const event = await prisma.breedingEvent.findUnique({
    where: { id },
    include: { dam: { select: { id: true, eartag: true, isPregnant: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Breeding event not found" }, { status: 404 });
  }

  const damAccess = await requireAnimalAccess(event.damId);
  if (!damAccess.ok) return damAccess.error;

  const body = await req.json();
  const updates: { pregnancyConfirmed?: boolean; notes?: string } = {};

  if (typeof body.pregnancyConfirmed === "boolean") {
    updates.pregnancyConfirmed = body.pregnancyConfirmed;
  }
  if (body.clearPregnancy === true) {
    updates.pregnancyConfirmed = false;
  }
  if (typeof body.notes === "string") {
    updates.notes = body.notes;
  }

  if (body.pregnancyConfirmed === true) {
    await prisma.animal.update({
      where: { id: event.damId },
      data: { isPregnant: true },
    });
    await logAnimalEvent({
      animalId: event.damId,
      type: "STATUS_CHANGE",
      title: "Marked pregnant",
      description: "Pregnancy confirmed",
      recordedById: result.user.id,
      metadata: { isPregnant: true, breedingEventId: id },
    });
  }

  if (body.clearPregnancy === true || body.pregnancyConfirmed === false) {
    await clearDamPregnancy(event.damId, {
      recordedById: result.user.id,
      reason:
        body.clearPregnancy === true
          ? "Marked open (not pregnant) after breeding check"
          : "Pregnancy not confirmed",
    });
  }

  const updated = await prisma.breedingEvent.update({
    where: { id },
    data: updates,
    include: {
      dam: { select: { id: true, eartag: true, isPregnant: true } },
      sire: { select: { id: true, eartag: true } },
      calving: { include: { calf: { select: { id: true, eartag: true } } } },
    },
  });

  return NextResponse.json(updated);
}
