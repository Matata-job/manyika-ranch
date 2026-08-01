import { prisma } from "@/lib/db";
import type { AlertType, Prisma } from "@prisma/client";

export const DEFAULT_HEALTH_NOTIFY_DAYS = 14;
export const DEFAULT_HEALTH_CALENDAR_DAYS = 60;
export const DEFAULT_WEIGHT_DROP_PERCENT = 15;
export const DEFAULT_MEDICINE_EXPIRY_DAYS = 30;

export function getHealthNotifyDaysEarly(settings: unknown): number {
  const raw = (settings as { healthNotifyDaysEarly?: unknown } | null)
    ?.healthNotifyDaysEarly;
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_HEALTH_NOTIFY_DAYS;
  return Math.min(Math.floor(n), 90);
}

export function getHealthCalendarDays(settings: unknown): number {
  const raw = (settings as { healthCalendarDays?: unknown } | null)
    ?.healthCalendarDays;
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 7) return DEFAULT_HEALTH_CALENDAR_DAYS;
  return Math.min(Math.floor(n), 180);
}

export function getWeightAlertDropPercent(settings: unknown): number {
  const raw = (settings as { weightAlertDropPercent?: unknown } | null)
    ?.weightAlertDropPercent;
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_WEIGHT_DROP_PERCENT;
  return Math.min(Math.floor(n), 80);
}

export function getWeightAlertMinKg(settings: unknown): number | null {
  const raw = (settings as { weightAlertMinKg?: unknown } | null)
    ?.weightAlertMinKg;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysUntil(due: Date, from = new Date()): number {
  const ms = startOfDay(due).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86400000);
}

/** Clear prior open nextDue so only the latest dose schedules the next one. */
export async function clearPriorVaccinationNextDue(
  animalId: string,
  vaccineName: string,
  exceptId?: string
) {
  await prisma.vaccination.updateMany({
    where: {
      animalId,
      vaccineName,
      nextDue: { not: null },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    data: { nextDue: null },
  });
}

export async function clearPriorTreatmentNextDue(
  animalId: string,
  product: string,
  exceptId?: string
) {
  await prisma.treatment.updateMany({
    where: {
      animalId,
      product,
      nextDue: { not: null },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    data: { nextDue: null },
  });
}

export async function upsertAlert(input: {
  type: AlertType;
  title: string;
  message: string;
  animalId?: string | null;
  dueDate?: Date | null;
  /** Extra match key when title may change (e.g. product name in message) */
  matchContains?: string;
}) {
  const existing = await prisma.alert.findFirst({
    where: {
      type: input.type,
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
      ...(input.animalId
        ? { animalId: input.animalId }
        : { animalId: null }),
      OR: [
        { title: input.title },
        ...(input.matchContains
          ? [{ title: { contains: input.matchContains } }, { message: { contains: input.matchContains } }]
          : []),
      ],
    },
  });

  if (existing) {
    await prisma.alert.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        message: input.message,
        dueDate: input.dueDate ?? null,
        status: "PENDING",
      },
    });
    return existing.id;
  }

  const created = await prisma.alert.create({
    data: {
      type: input.type,
      title: input.title,
      message: input.message,
      animalId: input.animalId ?? null,
      dueDate: input.dueDate ?? null,
    },
  });
  return created.id;
}

async function upsertHealthDueAlert(input: {
  type: "VACCINATION_DUE" | "TREATMENT_DUE";
  animalId: string;
  eartag: string;
  label: string;
  dueDate: Date;
}) {
  const days = daysUntil(input.dueDate);
  const when =
    days < 0
      ? `${Math.abs(days)} day(s) overdue`
      : days === 0
        ? "due today"
        : `due in ${days} day(s)`;
  const kind = input.type === "VACCINATION_DUE" ? "Vaccination" : "Treatment";
  const title = `${kind} due: ${input.eartag} — ${input.label}`;
  const message = `${input.label} for ${input.eartag} is ${when} (${input.dueDate.toISOString().slice(0, 10)})`;

  await upsertAlert({
    type: input.type,
    title,
    message,
    animalId: input.animalId,
    dueDate: input.dueDate,
    matchContains: input.label,
  });
}

/** Resolve open health alerts for an animal after a new dose is recorded. */
export async function resolveHealthAlertsForDose(
  animalId: string,
  type: AlertType,
  label: string
) {
  await prisma.alert.updateMany({
    where: {
      animalId,
      type,
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
      OR: [
        { title: { contains: label } },
        { message: { contains: label } },
      ],
    },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}

/**
 * Create/update vaccination and treatment alerts for overdue + calendar window.
 * notifyDaysEarly is used for messaging; calendarDays controls which dues get alerts
 * (aligned with the Health page so items you see there also appear in Alerts).
 */
export async function syncHealthDueAlerts(ranchId?: string): Promise<{
  vaccinations: number;
  treatments: number;
  notifyDaysEarly: number;
  calendarDays: number;
}> {
  const ranch = ranchId
    ? await prisma.ranch.findUnique({ where: { id: ranchId } })
    : await prisma.ranch.findFirst();
  const notifyDaysEarly = getHealthNotifyDaysEarly(ranch?.settings);
  const calendarDays = getHealthCalendarDays(ranch?.settings);
  // Alert horizon matches Health calendar so overdue + upcoming dues create alerts
  const horizonDays = Math.max(notifyDaysEarly, calendarDays);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + horizonDays);

  const animalFilter = {
    status: "ACTIVE" as const,
    ...(ranchId ? { camp: { ranchId } } : {}),
  };

  const [vaccinations, treatments] = await Promise.all([
    prisma.vaccination.findMany({
      where: {
        nextDue: { lte: horizon, not: null },
        animal: animalFilter,
      },
      include: { animal: { select: { id: true, eartag: true } } },
      orderBy: { nextDue: "asc" },
    }),
    prisma.treatment.findMany({
      where: {
        nextDue: { lte: horizon, not: null },
        animal: animalFilter,
      },
      include: { animal: { select: { id: true, eartag: true } } },
      orderBy: { nextDue: "asc" },
    }),
  ]);

  const activeVaccKeys = new Set<string>();
  let vaccCount = 0;
  for (const v of vaccinations) {
    if (!v.nextDue) continue;
    const key = `${v.animalId}:${v.vaccineName}`;
    if (activeVaccKeys.has(key)) continue;
    activeVaccKeys.add(key);
    await upsertHealthDueAlert({
      type: "VACCINATION_DUE",
      animalId: v.animalId,
      eartag: v.animal.eartag,
      label: v.vaccineName,
      dueDate: v.nextDue,
    });
    vaccCount += 1;
  }

  const activeTreatKeys = new Set<string>();
  let treatCount = 0;
  for (const t of treatments) {
    if (!t.nextDue) continue;
    const key = `${t.animalId}:${t.product}`;
    if (activeTreatKeys.has(key)) continue;
    activeTreatKeys.add(key);
    await upsertHealthDueAlert({
      type: "TREATMENT_DUE",
      animalId: t.animalId,
      eartag: t.animal.eartag,
      label: t.product,
      dueDate: t.nextDue,
    });
    treatCount += 1;
  }

  // Resolve stale health alerts that no longer have an open nextDue in window
  if (ranchId) {
    const openHealth = await prisma.alert.findMany({
      where: {
        type: { in: ["VACCINATION_DUE", "TREATMENT_DUE"] },
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
        animal: { camp: { ranchId } },
      },
      select: { id: true, type: true, animalId: true, title: true, message: true },
    });
    for (const a of openHealth) {
      if (!a.animalId) continue;
      const labelMatch =
        (a.title.split("—")[1] || "").trim() ||
        (a.message.split(" for ")[0] || "").trim();
      if (!labelMatch) continue;
      const stillDue =
        a.type === "VACCINATION_DUE"
          ? await prisma.vaccination.findFirst({
              where: {
                animalId: a.animalId,
                vaccineName: { contains: labelMatch },
                nextDue: { lte: horizon, not: null },
                animal: { status: "ACTIVE" },
              },
            })
          : await prisma.treatment.findFirst({
              where: {
                animalId: a.animalId,
                product: { contains: labelMatch },
                nextDue: { lte: horizon, not: null },
                animal: { status: "ACTIVE" },
              },
            });
      if (!stillDue) {
        await prisma.alert.update({
          where: { id: a.id },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        });
      }
    }
  }

  return { vaccinations: vaccCount, treatments: treatCount, notifyDaysEarly, calendarDays };
}

/** @deprecated Use syncHealthDueAlerts */
export async function checkVaccinationAlerts() {
  await syncHealthDueAlerts();
}

export type HealthCalendarItem = {
  id: string;
  kind: "vaccination" | "treatment";
  label: string;
  type?: string;
  nextDue: string;
  daysUntil: number;
  status: "overdue" | "due_soon" | "upcoming";
  animal: { id: string; eartag: string; camp: { id: string; name: string } };
};

export async function getHealthCalendar(options: {
  animalWhere: Prisma.AnimalWhereInput;
  daysAhead?: number;
  notifyDaysEarly?: number;
}): Promise<{
  notifyDaysEarly: number;
  daysAhead: number;
  overdue: HealthCalendarItem[];
  dueSoon: HealthCalendarItem[];
  upcoming: HealthCalendarItem[];
  items: HealthCalendarItem[];
}> {
  const daysAhead = options.daysAhead ?? DEFAULT_HEALTH_CALENDAR_DAYS;
  const notifyDaysEarly = options.notifyDaysEarly ?? DEFAULT_HEALTH_NOTIFY_DAYS;
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + daysAhead);
  const now = new Date();

  const [vaccinations, treatments] = await Promise.all([
    prisma.vaccination.findMany({
      where: {
        nextDue: { not: null, lte: horizon },
        animal: { status: "ACTIVE", ...options.animalWhere },
      },
      include: {
        animal: {
          select: {
            id: true,
            eartag: true,
            camp: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { nextDue: "asc" },
      take: 1000,
    }),
    prisma.treatment.findMany({
      where: {
        nextDue: { not: null, lte: horizon },
        animal: { status: "ACTIVE", ...options.animalWhere },
      },
      include: {
        animal: {
          select: {
            id: true,
            eartag: true,
            camp: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { nextDue: "asc" },
      take: 1000,
    }),
  ]);

  const items: HealthCalendarItem[] = [];

  for (const v of vaccinations) {
    if (!v.nextDue) continue;
    const d = daysUntil(v.nextDue, now);
    items.push({
      id: v.id,
      kind: "vaccination",
      label: v.vaccineName,
      nextDue: v.nextDue.toISOString(),
      daysUntil: d,
      status: d < 0 ? "overdue" : d <= notifyDaysEarly ? "due_soon" : "upcoming",
      animal: v.animal,
    });
  }
  for (const t of treatments) {
    if (!t.nextDue) continue;
    const d = daysUntil(t.nextDue, now);
    items.push({
      id: t.id,
      kind: "treatment",
      label: t.product,
      type: t.type,
      nextDue: t.nextDue.toISOString(),
      daysUntil: d,
      status: d < 0 ? "overdue" : d <= notifyDaysEarly ? "due_soon" : "upcoming",
      animal: t.animal,
    });
  }

  items.sort(
    (a, b) => new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime()
  );

  return {
    notifyDaysEarly,
    daysAhead,
    overdue: items.filter((i) => i.status === "overdue"),
    dueSoon: items.filter((i) => i.status === "due_soon"),
    upcoming: items.filter((i) => i.status === "upcoming"),
    items,
  };
}
