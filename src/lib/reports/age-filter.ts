import type { Prisma } from "@prisma/client";

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

/** Age band filter using DOB when present, else stored ageMonths. */
export function ageGroupWhere(
  ageGroup: string | null | undefined
): Prisma.AnimalWhereInput | undefined {
  if (!ageGroup || ageGroup === "all") return undefined;
  if (ageGroup === "calf") {
    return {
      OR: [
        { dob: { gt: monthsAgo(12) } },
        { AND: [{ dob: null }, { ageMonths: { lt: 12 } }] },
      ],
    };
  }
  if (ageGroup === "yearling") {
    return {
      OR: [
        {
          AND: [{ dob: { lte: monthsAgo(12) } }, { dob: { gt: monthsAgo(24) } }],
        },
        {
          AND: [{ dob: null }, { ageMonths: { gte: 12, lt: 24 } }],
        },
      ],
    };
  }
  if (ageGroup === "adult") {
    return {
      OR: [
        {
          AND: [{ dob: { lte: monthsAgo(24) } }, { dob: { gt: monthsAgo(60) } }],
        },
        {
          AND: [{ dob: null }, { ageMonths: { gte: 24, lt: 60 } }],
        },
      ],
    };
  }
  if (ageGroup === "mature") {
    return {
      OR: [
        { dob: { lte: monthsAgo(60) } },
        { AND: [{ dob: null }, { ageMonths: { gte: 60 } }] },
      ],
    };
  }
  return undefined;
}

/**
 * Custom age range in months (inclusive).
 * Uses DOB when present, else stored ageMonths.
 */
export function ageMonthsRangeWhere(
  minMonths: number | null | undefined,
  maxMonths: number | null | undefined
): Prisma.AnimalWhereInput | undefined {
  const min =
    minMonths != null && Number.isFinite(minMonths) && minMonths >= 0
      ? Math.floor(minMonths)
      : null;
  const max =
    maxMonths != null && Number.isFinite(maxMonths) && maxMonths >= 0
      ? Math.floor(maxMonths)
      : null;
  if (min == null && max == null) return undefined;
  if (min != null && max != null && min > max) return undefined;

  const dobParts: Prisma.DateTimeFilter = {};
  const ageParts: Prisma.IntNullableFilter = {};

  // At least `min` months old → born on or before monthsAgo(min)
  if (min != null) {
    dobParts.lte = monthsAgo(min);
    ageParts.gte = min;
  }
  // At most `max` months old → born on or after monthsAgo(max)
  if (max != null) {
    dobParts.gte = monthsAgo(max);
    ageParts.lte = max;
  }

  return {
    OR: [
      { dob: dobParts },
      { AND: [{ dob: null }, { ageMonths: ageParts }] },
    ],
  };
}

/** Filter by birth-date (DOB) range inclusive. */
export function dobRangeWhere(
  from: string | null | undefined,
  to: string | null | undefined
): Prisma.AnimalWhereInput | undefined {
  if (!from && !to) return undefined;
  return {
    dob: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    },
  };
}

export const AGE_GROUP_VALUES = [
  "all",
  "calf",
  "yearling",
  "adult",
  "mature",
] as const;

export type AgeGroupValue = (typeof AGE_GROUP_VALUES)[number];
