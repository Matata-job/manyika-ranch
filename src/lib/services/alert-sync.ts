import { prisma } from "@/lib/db";
import {
  DEFAULT_MEDICINE_EXPIRY_DAYS,
  getWeightAlertDropPercent,
  getWeightAlertMinKg,
  syncHealthDueAlerts,
  upsertAlert,
} from "@/lib/services/health-schedule";

/**
 * Sync all automated ranch alerts: health, weight, medicine, pending movements.
 */
export async function syncAllRanchAlerts(ranchId: string) {
  const ranch = await prisma.ranch.findUnique({ where: { id: ranchId } });
  const settings = ranch?.settings;

  const health = await syncHealthDueAlerts(ranchId);
  const weight = await syncWeightAlerts(ranchId, settings);
  const medicine = await syncMedicineAlerts(ranchId);
  const movements = await syncMovementAlerts(ranchId);

  return {
    notifyDaysEarly: health.notifyDaysEarly,
    calendarDays: health.calendarDays,
    vaccinations: health.vaccinations,
    treatments: health.treatments,
    weight,
    medicine,
    movements,
  };
}

export async function syncWeightAlerts(
  ranchId: string,
  settings?: unknown
): Promise<number> {
  const dropPercent = getWeightAlertDropPercent(settings);
  const minKg = getWeightAlertMinKg(settings);
  const threshold = 1 - dropPercent / 100;

  const animals = await prisma.animal.findMany({
    where: { status: "ACTIVE", camp: { ranchId } },
    select: {
      id: true,
      eartag: true,
      ageMonths: true,
      weightLogs: {
        orderBy: { date: "desc" },
        take: 2,
        select: { weightKg: true, date: true },
      },
    },
  });

  const activeAnimalIds = new Set<string>();
  let count = 0;

  for (const animal of animals) {
    const [latest, previous] = animal.weightLogs;
    if (!latest) continue;

    let reason: string | null = null;
    if (previous && latest.weightKg < previous.weightKg * threshold) {
      const drop = Math.round(
        ((previous.weightKg - latest.weightKg) / previous.weightKg) * 100
      );
      reason = `dropped ${drop}% (${previous.weightKg} → ${latest.weightKg} kg)`;
    } else if (
      minKg != null &&
      (animal.ageMonths == null || animal.ageMonths >= 12) &&
      latest.weightKg < minKg
    ) {
      reason = `${latest.weightKg} kg is below ranch minimum ${minKg} kg`;
    }

    if (!reason) continue;
    activeAnimalIds.add(animal.id);
    await upsertAlert({
      type: "WEIGHT_BELOW_TARGET",
      title: `Weight alert: ${animal.eartag}`,
      message: `${animal.eartag} ${reason}`,
      animalId: animal.id,
      dueDate: latest.date,
      matchContains: animal.eartag,
    });
    count += 1;
  }

  const open = await prisma.alert.findMany({
    where: {
      type: "WEIGHT_BELOW_TARGET",
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
      animal: { camp: { ranchId } },
    },
    select: { id: true, animalId: true },
  });
  for (const a of open) {
    if (!a.animalId || !activeAnimalIds.has(a.animalId)) {
      await prisma.alert.update({
        where: { id: a.id },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });
    }
  }

  return count;
}

export async function syncMedicineAlerts(ranchId: string): Promise<number> {
  const items = await prisma.medicineInventory.findMany({
    where: { ranchId },
    include: { camp: { select: { name: true } } },
  });

  const expiryHorizon = new Date();
  expiryHorizon.setDate(expiryHorizon.getDate() + DEFAULT_MEDICINE_EXPIRY_DAYS);

  const activeTitles = new Set<string>();
  let count = 0;

  for (const item of items) {
    const low = item.quantity <= item.minQuantity;
    const expiring = item.expiry != null && item.expiry <= expiryHorizon;
    if (!low && !expiring) continue;

    const camp = item.camp?.name ? ` @ ${item.camp.name}` : "";
    const title = `Medicine: ${item.name}${camp}`;
    activeTitles.add(title);

    const parts: string[] = [];
    if (low) {
      parts.push(
        `stock ${item.quantity} ${item.unit} (min ${item.minQuantity})`
      );
    }
    if (expiring && item.expiry) {
      parts.push(
        item.expiry < new Date()
          ? `expired ${item.expiry.toISOString().slice(0, 10)}`
          : `expires ${item.expiry.toISOString().slice(0, 10)}`
      );
    }

    await upsertAlert({
      type: "MEDICINE_LOW",
      title,
      message: `${item.name}${camp}: ${parts.join("; ")}`,
      animalId: null,
      dueDate: item.expiry,
    });
    count += 1;
  }

  const open = await prisma.alert.findMany({
    where: {
      type: "MEDICINE_LOW",
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
      animalId: null,
      title: { startsWith: "Medicine:" },
    },
    select: { id: true, title: true },
  });

  for (const a of open) {
    if (!activeTitles.has(a.title)) {
      // Only auto-resolve titles that belong to this ranch's current inventory names
      const belongs = items.some((item) => {
        const camp = item.camp?.name ? ` @ ${item.camp.name}` : "";
        return a.title === `Medicine: ${item.name}${camp}`;
      });
      if (belongs) {
        await prisma.alert.update({
          where: { id: a.id },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        });
      }
    }
  }

  return count;
}

export async function syncMovementAlerts(ranchId: string): Promise<number> {
  const pending = await prisma.movement.findMany({
    where: {
      status: "PENDING",
      OR: [
        { animal: { camp: { ranchId } } },
        { fromCamp: { ranchId } },
        { toCamp: { ranchId } },
      ],
    },
    include: {
      animal: { select: { id: true, eartag: true } },
      fromCamp: { select: { name: true } },
      toCamp: { select: { name: true } },
    },
    orderBy: { date: "asc" },
  });

  const activeTitles = new Set<string>();
  let count = 0;

  for (const m of pending) {
    const title = `Pending move: ${m.animal.eartag} · ${m.id}`;
    activeTitles.add(title);
    await upsertAlert({
      type: "MOVEMENT_PENDING",
      title,
      message: `${m.animal.eartag}: ${m.fromCamp.name} → ${m.toCamp.name} scheduled ${m.date.toISOString().slice(0, 10)}${m.reason ? ` — ${m.reason}` : ""}`,
      animalId: m.animalId,
      dueDate: m.date,
      matchContains: m.id,
    });
    count += 1;
  }

  const open = await prisma.alert.findMany({
    where: {
      type: "MOVEMENT_PENDING",
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
      OR: [
        { animal: { camp: { ranchId } } },
        { title: { startsWith: "Pending move:" } },
      ],
    },
    select: { id: true, title: true },
  });

  for (const a of open) {
    if (!activeTitles.has(a.title) && a.title.includes(" · ")) {
      await prisma.alert.update({
        where: { id: a.id },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });
    }
  }

  return count;
}

export async function refreshWeightAlertForAnimal(
  animalId: string,
  ranchId: string
) {
  const ranch = await prisma.ranch.findUnique({ where: { id: ranchId } });
  await syncWeightAlerts(ranchId, ranch?.settings);
  void animalId;
}

/** Complete a pending movement: apply camp change and resolve related alerts. */
export async function completePendingMovement(
  movementId: string,
  userId: string
) {
  const movement = await prisma.movement.findUnique({
    where: { id: movementId },
    include: {
      animal: { select: { id: true, eartag: true, campId: true, status: true } },
      fromCamp: { select: { id: true, name: true, ranchId: true } },
      toCamp: { select: { id: true, name: true, ranchId: true } },
    },
  });
  if (!movement) return { ok: false as const, error: "Movement not found", status: 404 };
  if (movement.status !== "PENDING") {
    return { ok: false as const, error: "Movement is not pending", status: 400 };
  }
  if (
    movement.animal.status === "DECEASED" ||
    movement.animal.status === "SOLD"
  ) {
    return {
      ok: false as const,
      error: `Cannot complete move for ${movement.animal.status.toLowerCase()} animal`,
      status: 400,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.movement.update({
      where: { id: movementId },
      data: { status: "COMPLETED" },
    });
    if (movement.animal.campId !== movement.toCampId) {
      await tx.animal.update({
        where: { id: movement.animalId },
        data: { campId: movement.toCampId },
      });
    }
    await tx.alert.updateMany({
      where: {
        type: "MOVEMENT_PENDING",
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
        OR: [
          { title: { contains: movementId } },
          {
            animalId: movement.animalId,
            title: { startsWith: `Pending move: ${movement.animal.eartag}` },
          },
        ],
      },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  });

  const { logAnimalEvent } = await import("@/lib/services/event-service");
  await logAnimalEvent({
    animalId: movement.animalId,
    type: "MOVEMENT",
    title: `Moved ${movement.fromCamp.name} → ${movement.toCamp.name}`,
    description: movement.reason || "Completed pending transfer",
    occurredAt: movement.date,
    recordedById: userId,
    metadata: {
      fromCampId: movement.fromCampId,
      toCampId: movement.toCampId,
      completedFromPending: true,
    },
  });

  return { ok: true as const, movement };
}
