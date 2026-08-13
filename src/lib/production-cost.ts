import { roundTzs } from "@/lib/money";
import type { ExpenseAllocGroupCode } from "@/lib/expense-categories";

const MS_DAY = 86_400_000;

export function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function monthKeyUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthBoundsUtc(key: string): { from: Date; to: Date } {
  const [y, m] = key.split("-").map(Number);
  return {
    from: new Date(Date.UTC(y, m - 1, 1)),
    to: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
  };
}

/** Inclusive calendar-day overlap of two UTC date ranges. */
export function daysOverlapInclusive(
  a0: Date,
  a1: Date,
  b0: Date,
  b1: Date
): number {
  const start = Math.max(utcDay(a0), utcDay(b0));
  const end = Math.min(utcDay(a1), utcDay(b1));
  if (end < start) return 0;
  return Math.round((end - start) / MS_DAY) + 1;
}

export type CampStay = { campId: string; from: Date; to: Date };

export function campStays(input: {
  currentCampId: string;
  start: Date;
  end: Date;
  movements: { date: Date; fromCampId: string; toCampId: string }[];
}): CampStay[] {
  if (utcDay(input.end) < utcDay(input.start)) return [];
  const movements = [...input.movements].sort(
    (a, b) => utcDay(a.date) - utcDay(b.date)
  );
  if (movements.length === 0) {
    return [
      { campId: input.currentCampId, from: input.start, to: input.end },
    ];
  }

  const stays: CampStay[] = [];
  let campId = movements[0].fromCampId;
  let cursor = input.start;

  for (const m of movements) {
    const moveDay = utcDay(m.date);
    if (moveDay > utcDay(input.end)) break;
    if (moveDay > utcDay(cursor)) {
      const stayEnd = new Date(moveDay - MS_DAY);
      if (utcDay(stayEnd) >= utcDay(cursor)) {
        stays.push({ campId, from: cursor, to: stayEnd });
      }
    }
    campId = m.toCampId;
    cursor = new Date(Math.max(moveDay, utcDay(input.start)));
  }

  if (utcDay(cursor) <= utcDay(input.end)) {
    stays.push({ campId, from: cursor, to: input.end });
  }
  return stays;
}

export function animalDaysInRange(input: {
  stays: CampStay[];
  from: Date;
  to: Date;
  campId: string | null;
}): number {
  let days = 0;
  for (const stay of input.stays) {
    if (input.campId && stay.campId !== input.campId) continue;
    days += daysOverlapInclusive(stay.from, stay.to, input.from, input.to);
  }
  return days;
}

function matchesAllocGroup(
  herdPlan: string,
  group: ExpenseAllocGroupCode
): boolean {
  if (group === "NONE") return false;
  if (group === "ALL_ACTIVE") return true;
  return herdPlan === group;
}

function inRange(date: Date, from: Date, to: Date): boolean {
  const t = date.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export type ProductionCostAnimalInput = {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  status: string;
  herdPlan: string;
  campId: string;
  campName: string;
  acquisitionType: string;
  acquisitionDate: Date | null;
  createdAt: Date;
  dob: Date | null;
  purchasePriceTzs: number | null;
  movements: { date: Date; fromCampId: string; toCampId: string }[];
  treatments: { date: Date; costTzs: number | null }[];
  vaccinations: { date: Date; costTzs: number | null }[];
  weights: { date: Date; weightKg: number }[];
  sales: {
    saleDate: Date;
    priceTzs: number;
    weightAtSale: number | null;
    returnedAt?: Date | null;
  }[];
  deathDate: Date | null;
};

export type ProductionCostExpenseInput = {
  id: string;
  amountTzs: number;
  date: Date;
  campId: string | null;
  fundingSource: string;
  allocGroup: string;
};

export type ProductionCostRow = {
  animalId: string;
  eartag: string;
  breed: string;
  sex: string;
  status: string;
  herdPlan: string;
  campId: string;
  campName: string;
  animalDays: number;
  purchasePriceTzs: number;
  purchaseInPeriodTzs: number;
  feedShareTzs: number;
  treatmentTzs: number;
  periodCostTzs: number;
  startWeightKg: number | null;
  endWeightKg: number | null;
  weightGainKg: number | null;
  costPerKgTzs: number | null;
  salePriceTzs: number | null;
  marginTzs: number | null;
};

export type ProductionCostResult = {
  rows: ProductionCostRow[];
  summary: {
    animalCount: number;
    allocatedFeedTzs: number;
    treatmentTzs: number;
    purchaseInPeriodTzs: number;
    periodCostTzs: number;
    projectSpendTzs: number;
    unallocatedOperatingTzs: number;
    avgPeriodCostTzs: number | null;
  };
};

function animalLife(animal: ProductionCostAnimalInput, now: Date): {
  start: Date;
  end: Date;
} {
  const start =
    animal.acquisitionDate || animal.dob || animal.createdAt;
  const saleEnd = animal.sales.reduce<Date | null>((latest, s) => {
    if ("returnedAt" in s && s.returnedAt) return latest;
    if (!latest || s.saleDate.getTime() > latest.getTime()) return s.saleDate;
    return latest;
  }, null);
  const endCandidates = [now];
  if (animal.deathDate) endCandidates.push(animal.deathDate);
  if (saleEnd) endCandidates.push(saleEnd);
  const end = new Date(Math.min(...endCandidates.map((d) => d.getTime())));
  return { start, end };
}

function periodWeights(
  weights: { date: Date; weightKg: number }[],
  from: Date,
  to: Date
): { start: number | null; end: number | null; gain: number | null } {
  const sorted = [...weights].sort((a, b) => a.date.getTime() - b.date.getTime());
  const before = [...sorted].reverse().find((w) => w.date.getTime() < from.getTime());
  const inPeriod = sorted.filter(
    (w) => w.date.getTime() >= from.getTime() && w.date.getTime() <= to.getTime()
  );
  const start = before?.weightKg ?? inPeriod[0]?.weightKg ?? null;
  const end =
    inPeriod.length > 0
      ? inPeriod[inPeriod.length - 1].weightKg
      : start;
  if (start == null || end == null) {
    return { start, end: end ?? null, gain: null };
  }
  const gain = roundTzs(end - start);
  return { start, end, gain };
}

/**
 * Cash production cost per animal for a period.
 * Shared operating expenses with an alloc group are split by camp animal-days
 * in the expense's calendar month. Project spend is never allocated.
 */
export function computeProductionCosts(input: {
  periodFrom: Date;
  periodTo: Date;
  now?: Date;
  expenses: ProductionCostExpenseInput[];
  animals: ProductionCostAnimalInput[];
}): ProductionCostResult {
  const now = input.now ?? new Date();
  const from = input.periodFrom;
  const to = input.periodTo;

  const prepared = input.animals.map((animal) => {
    const life = animalLife(animal, now);
    const stays = campStays({
      currentCampId: animal.campId,
      start: life.start,
      end: life.end,
      movements: animal.movements,
    });
    return { animal, life, stays };
  });

  const feedShare = new Map<string, number>();
  for (const a of prepared) feedShare.set(a.animal.id, 0);

  let allocatedFeedTzs = 0;
  let projectSpendTzs = 0;
  let unallocatedOperatingTzs = 0;

  type Bucket = {
    campId: string | null;
    allocGroup: ExpenseAllocGroupCode;
    month: string;
    amount: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const e of input.expenses) {
    if (!inRange(e.date, from, to)) continue;
    if (e.fundingSource === "PROJECT") {
      projectSpendTzs += e.amountTzs;
      continue;
    }
    const group = e.allocGroup as ExpenseAllocGroupCode;
    if (group === "NONE" || !group) {
      unallocatedOperatingTzs += e.amountTzs;
      continue;
    }
    const month = monthKeyUtc(e.date);
    const key = `${month}|${e.campId ?? "ranch"}|${group}`;
    const prev = buckets.get(key);
    if (prev) prev.amount += e.amountTzs;
    else {
      buckets.set(key, {
        campId: e.campId,
        allocGroup: group,
        month,
        amount: e.amountTzs,
      });
    }
  }

  for (const bucket of buckets.values()) {
    const bounds = monthBoundsUtc(bucket.month);
    const sliceFrom = new Date(Math.max(utcDay(bounds.from), utcDay(from)));
    const sliceTo = new Date(Math.min(bounds.to.getTime(), to.getTime()));
    const eligible = prepared.filter((p) =>
      matchesAllocGroup(p.animal.herdPlan, bucket.allocGroup)
    );
    const daysByAnimal = eligible.map((p) => ({
      id: p.animal.id,
      days: animalDaysInRange({
        stays: p.stays,
        from: sliceFrom,
        to: sliceTo,
        campId: bucket.campId,
      }),
    }));
    const totalDays = daysByAnimal.reduce((s, x) => s + x.days, 0);
    if (totalDays <= 0) {
      unallocatedOperatingTzs += bucket.amount;
      continue;
    }
    allocatedFeedTzs += bucket.amount;
    for (const row of daysByAnimal) {
      if (row.days <= 0) continue;
      const share = bucket.amount * (row.days / totalDays);
      feedShare.set(row.id, (feedShare.get(row.id) || 0) + share);
    }
  }

  const rows: ProductionCostRow[] = prepared.map(({ animal, stays }) => {
    const doseCost = (rows: { date: Date; costTzs: number | null }[]) =>
      rows.reduce((s, d) => {
        if (d.costTzs == null || d.costTzs <= 0) return s;
        if (!inRange(d.date, from, to)) return s;
        return s + d.costTzs;
      }, 0);

    const treatmentTzs =
      doseCost(animal.treatments) + doseCost(animal.vaccinations);

    const purchasePriceTzs =
      animal.acquisitionType === "PURCHASED" && animal.purchasePriceTzs
        ? animal.purchasePriceTzs
        : 0;
    const purchaseDate = animal.acquisitionDate || animal.createdAt;
    const purchaseInPeriodTzs =
      animal.acquisitionType === "PURCHASED" &&
      purchasePriceTzs > 0 &&
      inRange(purchaseDate, from, to)
        ? purchasePriceTzs
        : 0;

    const feed = feedShare.get(animal.id) || 0;
    const periodCostTzs = feed + treatmentTzs + purchaseInPeriodTzs;
    const weights = periodWeights(animal.weights, from, to);
    const feedingCost = feed + treatmentTzs;
    const costPerKgTzs =
      weights.gain != null && weights.gain > 0.5
        ? roundTzs(feedingCost / weights.gain)
        : null;

    const saleInPeriod = [...animal.sales]
      .filter((s) => !s.returnedAt && inRange(s.saleDate, from, to))
      .sort((a, b) => b.saleDate.getTime() - a.saleDate.getTime())[0];

    const animalDays = animalDaysInRange({
      stays,
      from,
      to,
      campId: null,
    });

    return {
      animalId: animal.id,
      eartag: animal.eartag,
      breed: animal.breed,
      sex: animal.sex,
      status: animal.status,
      herdPlan: animal.herdPlan,
      campId: animal.campId,
      campName: animal.campName,
      animalDays,
      purchasePriceTzs: roundTzs(purchasePriceTzs),
      purchaseInPeriodTzs: roundTzs(purchaseInPeriodTzs),
      feedShareTzs: roundTzs(feed),
      treatmentTzs: roundTzs(treatmentTzs),
      periodCostTzs: roundTzs(periodCostTzs),
      startWeightKg: weights.start,
      endWeightKg: weights.end,
      weightGainKg: weights.gain,
      costPerKgTzs,
      salePriceTzs: saleInPeriod ? roundTzs(saleInPeriod.priceTzs) : null,
      marginTzs: saleInPeriod
        ? roundTzs(saleInPeriod.priceTzs - periodCostTzs)
        : null,
    };
  });

  rows.sort((a, b) => b.periodCostTzs - a.periodCostTzs);

  const periodCostTzs = rows.reduce((s, r) => s + r.periodCostTzs, 0);
  const treatmentTzs = rows.reduce((s, r) => s + r.treatmentTzs, 0);
  const purchaseInPeriodTzs = rows.reduce((s, r) => s + r.purchaseInPeriodTzs, 0);
  const withCost = rows.filter((r) => r.animalDays > 0 || r.periodCostTzs > 0);

  return {
    rows,
    summary: {
      animalCount: withCost.length,
      allocatedFeedTzs: roundTzs(allocatedFeedTzs),
      treatmentTzs: roundTzs(treatmentTzs),
      purchaseInPeriodTzs: roundTzs(purchaseInPeriodTzs),
      periodCostTzs: roundTzs(periodCostTzs),
      projectSpendTzs: roundTzs(projectSpendTzs),
      unallocatedOperatingTzs: roundTzs(unallocatedOperatingTzs),
      avgPeriodCostTzs:
        withCost.length > 0 ? roundTzs(periodCostTzs / withCost.length) : null,
    },
  };
}
