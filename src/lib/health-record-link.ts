import { prisma } from "@/lib/db";

/** Resolve optional healthRecordId — must belong to the same animal. */
export async function resolveHealthRecordId(
  animalId: string,
  healthRecordId: unknown
): Promise<
  { ok: true; value: string | null } | { ok: false; error: string }
> {
  if (
    healthRecordId === undefined ||
    healthRecordId === null ||
    healthRecordId === ""
  ) {
    return { ok: true, value: null };
  }
  if (typeof healthRecordId !== "string") {
    return { ok: false, error: "Invalid health record link" };
  }
  const record = await prisma.healthRecord.findFirst({
    where: { id: healthRecordId, animalId },
    select: { id: true },
  });
  if (!record) {
    return {
      ok: false,
      error: "Clinical note not found for this animal",
    };
  }
  return { ok: true, value: record.id };
}

export const healthRecordSummarySelect = {
  id: true,
  date: true,
  type: true,
  diagnosis: true,
} as const;
