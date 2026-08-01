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

export const AGE_GROUP_VALUES = [
  "all",
  "calf",
  "yearling",
  "adult",
  "mature",
] as const;

export type AgeGroupValue = (typeof AGE_GROUP_VALUES)[number];
