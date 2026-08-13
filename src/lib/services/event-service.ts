import { prisma } from "@/lib/db";
import type { AnimalEventType, Prisma } from "@prisma/client";
import { formatMortalityEventDescription } from "@/lib/death-causes";

function toInputJson(
  metadata?: Record<string, unknown> | null
): Prisma.InputJsonValue | undefined {
  if (!metadata) return undefined;
  // Ensure Dates become ISO strings and strip undefined (valid JSON for Prisma)
  return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
}

export async function logAnimalEvent(params: {
  animalId: string;
  type: AnimalEventType;
  title: string;
  description?: string | null;
  occurredAt?: Date;
  recordedById?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.animalEvent.create({
    data: {
      animalId: params.animalId,
      type: params.type,
      title: params.title,
      description: params.description || undefined,
      occurredAt: params.occurredAt || new Date(),
      recordedById: params.recordedById || undefined,
      metadata: toInputJson(params.metadata),
    },
  });
}

export type BulkAnimalEventInput = {
  animalId: string;
  type: AnimalEventType;
  title: string;
  description?: string | null;
  occurredAt?: Date;
  recordedById?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Create many animal timeline events (used by bulk sale / cull / treatment / move). */
export async function logAnimalEventsBulk(
  events: BulkAnimalEventInput[]
): Promise<number> {
  if (events.length === 0) return 0;

  const rows = events.map((e) => ({
    animalId: e.animalId,
    type: e.type,
    title: e.title,
    description: e.description || undefined,
    occurredAt: e.occurredAt || new Date(),
    recordedById: e.recordedById || undefined,
    metadata: toInputJson(e.metadata),
  }));

  try {
    const result = await prisma.animalEvent.createMany({ data: rows });
    return result.count;
  } catch {
    // Fallback if createMany rejects JSON/shape for some rows
    let count = 0;
    for (const row of rows) {
      try {
        await prisma.animalEvent.create({ data: row });
        count += 1;
      } catch {
        // continue remaining
      }
    }
    return count;
  }
}

function dayRange(d: Date): { gte: Date; lte: Date } {
  const gte = new Date(d);
  gte.setHours(0, 0, 0, 0);
  const lte = new Date(d);
  lte.setHours(23, 59, 59, 999);
  return { gte, lte };
}

/**
 * Repair timeline gaps: create AnimalEvent rows for sales / deaths / treatments /
 * completed movements that never got an event (e.g. older bulk ops).
 */
export async function backfillMissingRanchEvents(
  ranchId: string
): Promise<{ created: number }> {
  const since = new Date();
  since.setDate(since.getDate() - 180);
  let created = 0;

  const animalWhere = { camp: { ranchId } };

  const sales = await prisma.sale.findMany({
    where: {
      animal: animalWhere,
      OR: [{ saleDate: { gte: since } }, { createdAt: { gte: since } }],
    },
    include: { animal: { select: { eartag: true } } },
    orderBy: { saleDate: "desc" },
    take: 400,
  });

  for (const sale of sales) {
    const byMeta = await prisma.animalEvent.findFirst({
      where: {
        animalId: sale.animalId,
        type: "SALE",
        metadata: { path: ["saleId"], equals: sale.id },
      },
      select: { id: true },
    });
    if (byMeta) continue;

    const sameDay = await prisma.animalEvent.findFirst({
      where: {
        animalId: sale.animalId,
        type: "SALE",
        occurredAt: dayRange(sale.saleDate),
      },
      select: { id: true },
    });
    if (sameDay) continue;

    await logAnimalEvent({
      animalId: sale.animalId,
      type: "SALE",
      title: `Sold to ${sale.buyer}`,
      description: [
        `TZS ${sale.priceTzs.toLocaleString()}`,
        sale.weightAtSale ? `${sale.weightAtSale} kg` : null,
        "backfilled",
      ]
        .filter(Boolean)
        .join(" · "),
      occurredAt: sale.saleDate,
      metadata: {
        saleId: sale.id,
        buyer: sale.buyer,
        buyerId: sale.buyerId,
        priceTzs: sale.priceTzs,
        weightAtSale: sale.weightAtSale,
        backfilled: true,
      },
    });
    created += 1;
  }

  const deaths = await prisma.deathRecord.findMany({
    where: {
      animal: animalWhere,
      OR: [{ date: { gte: since } }, { createdAt: { gte: since } }],
    },
    include: { animal: { select: { eartag: true } } },
    orderBy: { date: "desc" },
    take: 400,
  });

  for (const death of deaths) {
    const type: AnimalEventType = death.isCulling ? "CULLING" : "DEATH";
    const existing = await prisma.animalEvent.findFirst({
      where: {
        animalId: death.animalId,
        type: { in: ["DEATH", "CULLING"] },
        occurredAt: dayRange(death.date),
      },
      select: { id: true },
    });
    if (existing) continue;

    await logAnimalEvent({
      animalId: death.animalId,
      type,
      title: death.isCulling
        ? `Slaughtered: ${death.animal.eartag}`
        : `Death recorded: ${death.animal.eartag}`,
      description: formatMortalityEventDescription({
        cause: death.cause,
        causeDetail: death.causeDetail,
        disposalMethod: death.disposalMethod,
        disposalNotes: death.disposalNotes,
        isCulling: death.isCulling,
        extra: ["backfilled"],
      }),
      occurredAt: death.date,
      recordedById: death.recordedById,
      metadata: {
        cause: death.cause,
        disposalMethod: death.disposalMethod,
        isCulling: death.isCulling,
        deathRecordId: death.id,
        backfilled: true,
      },
    });
    created += 1;
  }

  const treatments = await prisma.treatment.findMany({
    where: {
      animal: animalWhere,
      OR: [{ date: { gte: since } }, { createdAt: { gte: since } }],
    },
    include: { animal: { select: { eartag: true } } },
    orderBy: { date: "desc" },
    take: 400,
  });

  for (const tr of treatments) {
    const existing = await prisma.animalEvent.findFirst({
      where: {
        animalId: tr.animalId,
        type: "TREATMENT",
        occurredAt: dayRange(tr.date),
        OR: [
          { metadata: { path: ["product"], equals: tr.product } },
          { description: { contains: tr.product } },
          { title: { contains: tr.type.replace(/_/g, " ") } },
        ],
      },
      select: { id: true },
    });
    if (existing) continue;

    await logAnimalEvent({
      animalId: tr.animalId,
      type: "TREATMENT",
      title: `Treatment: ${tr.type.replace(/_/g, " ")}`,
      description: [
        tr.product,
        tr.dose ? `Dose: ${tr.dose}` : null,
        tr.nextDue
          ? `Next due ${tr.nextDue.toISOString().slice(0, 10)}`
          : null,
        "backfilled",
      ]
        .filter(Boolean)
        .join(" · "),
      occurredAt: tr.date,
      recordedById: tr.administeredById,
      metadata: {
        type: tr.type,
        product: tr.product,
        treatmentId: tr.id,
        backfilled: true,
      },
    });
    created += 1;
  }

  const movements = await prisma.movement.findMany({
    where: {
      status: "COMPLETED",
      AND: [
        {
          OR: [
            { fromCamp: { ranchId } },
            { toCamp: { ranchId } },
            { animal: animalWhere },
          ],
        },
        {
          OR: [{ date: { gte: since } }, { createdAt: { gte: since } }],
        },
      ],
    },
    include: {
      fromCamp: { select: { name: true } },
      toCamp: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 400,
  });

  for (const mov of movements) {
    const existing = await prisma.animalEvent.findFirst({
      where: {
        animalId: mov.animalId,
        type: "MOVEMENT",
        occurredAt: dayRange(mov.date),
        OR: [
          { metadata: { path: ["movementId"], equals: mov.id } },
          {
            AND: [
              { metadata: { path: ["fromCampId"], equals: mov.fromCampId } },
              { metadata: { path: ["toCampId"], equals: mov.toCampId } },
            ],
          },
        ],
      },
      select: { id: true },
    });
    if (existing) continue;

    // Also accept any MOVEMENT same day for this animal as coverage
    const anySameDay = await prisma.animalEvent.findFirst({
      where: {
        animalId: mov.animalId,
        type: "MOVEMENT",
        occurredAt: dayRange(mov.date),
      },
      select: { id: true },
    });
    if (anySameDay) continue;

    await logAnimalEvent({
      animalId: mov.animalId,
      type: "MOVEMENT",
      title: `Moved ${mov.fromCamp.name} → ${mov.toCamp.name}`,
      description: [mov.reason, "backfilled"].filter(Boolean).join(" · "),
      occurredAt: mov.date,
      recordedById: mov.authorizedById,
      metadata: {
        movementId: mov.id,
        fromCampId: mov.fromCampId,
        toCampId: mov.toCampId,
        backfilled: true,
      },
    });
    created += 1;
  }

  return { created };
}
