import { prisma } from "@/lib/db";
import { computeAgeMonths } from "@/lib/utils";

export async function recordCalving(
  breedingEventId: string | null,
  body: Record<string, unknown>,
  _userId: string
) {
  const damId = body.damId as string;
  const dob = new Date(body.date as string);

  let calf = null;
  if (body.createCalf && body.calfEartag) {
    const dam = await prisma.animal.findUnique({ where: { id: damId } });
    if (!dam) throw new Error("Dam not found");

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

  return calving;
}
