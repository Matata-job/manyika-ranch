import { prisma } from "@/lib/db";
import type { AlertType, Prisma } from "@prisma/client";

export const DEFAULT_HEALTH_NOTIFY_DAYS = 14;
export const DEFAULT_HEALTH_CALENDAR_DAYS = 60;

export function getHealthNotifyDaysEarly(settings: unknown): number {
  const raw = (settings as { healthNotifyDaysEarly?: unknown } | null)
    ?.healthNotifyDaysEarly;
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_HEALTH_NOTIFY_DAYS;
  return Math.min(Math.floor(n), 90);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysUntil(due: Date, from = new Date()): number {
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

async function upsertDueAlert(input: {
  type: AlertType;
  animalId: string;
  eartag: string;
  label: string;
  dueDate: Date;
}) {
  const title =
    input.type === "VACCINATION_DUE"
      ? `Vaccination due: ${input.eartag} — ${input.label}`
      : `Treatment due: ${input.eartag} — ${input.label}`;
  const days = daysUntil(input.dueDate);
  const when =
    days < 0
      ? `${Math.abs(days)} day(s) overdue`
      : days === 0
        ? "due today"
        : `due in ${days} day(s)`;
  const message =
    input.type === "VACCINATION_DUE"
      ? `${input.label} for ${input.eartag} is ${when} (${input.dueDate.toISOString().slice(0, 10)})`
      : `${input.label} for ${input.eartag} is ${when} (${input.dueDate.toISOString().slice(0, 10)})`;

  const existing = await prisma.alert.findFirst({
    where: {
      type: input.type,
      animalId: input.animalId,
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
      title,
    },
  });

  if (existing) {
    await prisma.alert.update({
      where: { id: existing.id },
      data: { message, dueDate: input.dueDate, status: "PENDING" },
    });
    return;
  }

  await prisma.alert.create({
    data: {
      type: input.type,
      title,
      message,
      animalId: input.animalId,
      dueDate: input.dueDate,
    },
  });
}

/** Resolve open health alerts for an animal after a new dose is recorded. */
export async function resolveHealthAlertsForDose(
  animalId: string,
  type: AlertType,
  label: string
) {
  const titleFragment =
    type === "VACCINATION_DUE"
      ? `Vaccination due:`
      : `Treatment due:`;
  await prisma.alert.updateMany({
    where: {
      animalId,
      type,
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
      title: { contains: label },
    },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  // Fallback: resolve any matching type+animal with product in title
  void titleFragment;
}

/**
 * Create/update early + overdue vaccination and treatment alerts.
 * Lead time comes from ranch settings (default 14 days).
 */
export async function syncHealthDueAlerts(ranchId?: string): Promise<{
  vaccinations: number;
  treatments: number;
  notifyDaysEarly: number;
}> {
  const ranch = ranchId
    ? await prisma.ranch.findUnique({ where: { id: ranchId } })
    : await prisma.ranch.findFirst();
  const notifyDaysEarly = getHealthNotifyDaysEarly(ranch?.settings);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + notifyDaysEarly);

  const [vaccinations, treatments] = await Promise.all([
    prisma.vaccination.findMany({
      where: {
        nextDue: { lte: horizon, not: null },
        animal: { status: "ACTIVE", ...(ranchId ? { camp: { ranchId } } : {}) },
      },
      include: { animal: { select: { id: true, eartag: true } } },
      orderBy: { nextDue: "asc" },
    }),
    prisma.treatment.findMany({
      where: {
        nextDue: { lte: horizon, not: null },
        animal: { status: "ACTIVE", ...(ranchId ? { camp: { ranchId } } : {}) },
      },
      include: { animal: { select: { id: true, eartag: true } } },
      orderBy: { nextDue: "asc" },
    }),
  ]);

  // One alert per animal + vaccine/product (latest due only already via cleared priors)
  const vaccSeen = new Set<string>();
  let vaccCount = 0;
  for (const v of vaccinations) {
    if (!v.nextDue) continue;
    const key = `${v.animalId}:${v.vaccineName}`;
    if (vaccSeen.has(key)) continue;
    vaccSeen.add(key);
    await upsertDueAlert({
      type: "VACCINATION_DUE",
      animalId: v.animalId,
      eartag: v.animal.eartag,
      label: v.vaccineName,
      dueDate: v.nextDue,
    });
    vaccCount += 1;
  }

  const treatSeen = new Set<string>();
  let treatCount = 0;
  for (const t of treatments) {
    if (!t.nextDue) continue;
    const key = `${t.animalId}:${t.product}`;
    if (treatSeen.has(key)) continue;
    treatSeen.add(key);
    await upsertDueAlert({
      type: "TREATMENT_DUE",
      animalId: t.animalId,
      eartag: t.animal.eartag,
      label: t.product,
      dueDate: t.nextDue,
    });
    treatCount += 1;
  }

  return { vaccinations: vaccCount, treatments: treatCount, notifyDaysEarly };
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
