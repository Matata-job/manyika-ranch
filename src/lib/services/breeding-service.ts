import { prisma } from "@/lib/db";
import { computeAgeMonths } from "@/lib/utils";
import { logAnimalEvent } from "@/lib/services/event-service";

/** Clear herd pregnancy flag after calving / calf link (camps run with bulls year-round). */
export async function clearDamPregnancy(
  damId: string,
  opts: {
    recordedById?: string | null;
    reason: string;
    calfEartag?: string | null;
    occurredAt?: Date;
  }
) {
  const dam = await prisma.animal.findUnique({
    where: { id: damId },
    select: { id: true, sex: true, isPregnant: true, eartag: true },
  });
  if (!dam || dam.sex !== "FEMALE" || !dam.isPregnant) return null;

  await prisma.animal.update({
    where: { id: damId },
    data: { isPregnant: false },
  });

  await logAnimalEvent({
    animalId: damId,
    type: "STATUS_CHANGE",
    title: "Pregnancy cleared",
    description: opts.calfEartag
      ? `${opts.reason} · calf ${opts.calfEartag}`
      : opts.reason,
    occurredAt: opts.occurredAt,
    recordedById: opts.recordedById,
    metadata: {
      isPregnant: false,
      reason: opts.reason,
      calfEartag: opts.calfEartag || null,
    },
  });

  return dam;
}

export async function recordCalving(
  breedingEventId: string | null,
  body: Record<string, unknown>,
  userId: string
) {
  const damId = body.damId as string;
  const dob = new Date(body.date as string);

  const dam = await prisma.animal.findUnique({ where: { id: damId } });
  if (!dam) throw new Error("Dam not found");

  let calf = null;
  if (body.createCalf && body.calfEartag) {
    calf = await prisma.animal.create({
      data: {
        eartag: body.calfEartag as string,
        breed: (body.calfBreed as string) || dam.breed,
        sex: body.calfSex as "MALE" | "FEMALE",
        dob,
        ageMonths: computeAgeMonths(dob),
        ownerId: dam.ownerId,
        sireId: body.sireId as string | undefined,
        damId,
        campId: dam.campId,
        acquisitionType: "BORN_ON_FARM",
        acquisitionDate: dob,
        status: "ACTIVE",
      },
    });

    await logAnimalEvent({
      animalId: calf.id,
      type: "REGISTERED",
      title: `Registered ${calf.eartag}`,
      description: `Born on farm · dam ${dam.eartag}`,
      occurredAt: dob,
      recordedById: userId,
      metadata: { damId, sireId: body.sireId || null },
    });
  }

  const calving = await prisma.calvingRecord.create({
    data: {
      breedingEventId,
      damId,
      calfId: calf?.id,
      date: dob,
      birthWeightKg: body.birthWeightKg as number | undefined,
      complications: body.complications as string | undefined,
      notes: body.notes as string | undefined,
    },
    include: { calf: { select: { id: true, eartag: true } } },
  });

  await logAnimalEvent({
    animalId: damId,
    type: "CALVING",
    title: calf ? `Calved · ${calf.eartag}` : "Calving recorded",
    description: body.notes ? String(body.notes) : undefined,
    occurredAt: dob,
    recordedById: userId,
    metadata: {
      calvingId: calving.id,
      calfId: calf?.id || null,
      breedingEventId,
    },
  });

  await clearDamPregnancy(damId, {
    recordedById: userId,
    reason: "Calving recorded",
    calfEartag: calf?.eartag,
    occurredAt: dob,
  });

  if (breedingEventId) {
    await prisma.breedingEvent.update({
      where: { id: breedingEventId },
      data: { pregnancyConfirmed: true },
    });
  }

  return calving;
}
