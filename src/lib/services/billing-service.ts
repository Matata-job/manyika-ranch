import type { InvoiceStatus } from "@prisma/client";

export type YearMonth = { year: number; month: number };

export type BillingPeriodPreset =
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months"
  | "custom";

export function invoiceBalance(amountTzs: number, amountPaidTzs: number): number {
  return Math.max(0, Math.round((amountTzs - amountPaidTzs) * 100) / 100);
}

export function deriveInvoiceStatus(
  amountTzs: number,
  amountPaidTzs: number,
  current: InvoiceStatus
): InvoiceStatus {
  if (current === "VOID" || current === "DRAFT") return current;
  const paid = amountPaidTzs;
  if (paid <= 0) return "ISSUED";
  if (paid + 0.001 >= amountTzs) return "PAID";
  return "PARTIAL";
}

export function periodLabel(year: number, month: number, locale = "en"): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(locale === "sw" ? "sw-TZ" : "en-TZ", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year - b.year || a.month - b.month;
}

export function isValidYearMonth(p: YearMonth): boolean {
  return (
    Number.isFinite(p.year) &&
    Number.isFinite(p.month) &&
    p.month >= 1 &&
    p.month <= 12 &&
    p.year >= 2000 &&
    p.year <= 2100
  );
}

/** Inclusive list of calendar months from `from` through `to`. */
export function expandPeriodRange(from: YearMonth, to: YearMonth): YearMonth[] {
  if (compareYearMonth(from, to) > 0) return [];
  const out: YearMonth[] = [];
  let y = from.year;
  let m = from.month;
  while (y < to.year || (y === to.year && m <= to.month)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function shiftMonth(base: YearMonth, delta: number): YearMonth {
  const idx = base.year * 12 + (base.month - 1) + delta;
  return {
    year: Math.floor(idx / 12),
    month: ((idx % 12) + 12) % 12 + 1,
  };
}

export function resolvePresetRange(
  preset: BillingPeriodPreset,
  now = new Date(),
  custom?: { from: YearMonth; to: YearMonth }
): { from: YearMonth; to: YearMonth } | null {
  const thisMonth: YearMonth = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };

  switch (preset) {
    case "this_month":
      return { from: thisMonth, to: thisMonth };
    case "last_month": {
      const last = shiftMonth(thisMonth, -1);
      return { from: last, to: last };
    }
    case "this_year":
      return {
        from: { year: thisMonth.year, month: 1 },
        to: thisMonth,
      };
    case "last_year":
      return {
        from: { year: thisMonth.year - 1, month: 1 },
        to: { year: thisMonth.year - 1, month: 12 },
      };
    case "last_3_months":
      return { from: shiftMonth(thisMonth, -2), to: thisMonth };
    case "last_6_months":
      return { from: shiftMonth(thisMonth, -5), to: thisMonth };
    case "last_12_months":
      return { from: shiftMonth(thisMonth, -11), to: thisMonth };
    case "custom":
      if (!custom || !isValidYearMonth(custom.from) || !isValidYearMonth(custom.to)) {
        return null;
      }
      if (compareYearMonth(custom.from, custom.to) > 0) return null;
      return custom;
    default:
      return null;
  }
}

export function periodRangeLabel(
  from: YearMonth,
  to: YearMonth,
  locale = "en"
): string {
  if (from.year === to.year && from.month === to.month) {
    return periodLabel(from.year, from.month, locale);
  }
  return `${periodLabel(from.year, from.month, locale)} – ${periodLabel(to.year, to.month, locale)}`;
}

/** Prisma where fragment for inclusive year-month range. */
export function periodRangeWhere(from: YearMonth, to: YearMonth) {
  return {
    AND: [
      {
        OR: [
          { periodYear: { gt: from.year } },
          { periodYear: from.year, periodMonth: { gte: from.month } },
        ],
      },
      {
        OR: [
          { periodYear: { lt: to.year } },
          { periodYear: to.year, periodMonth: { lte: to.month } },
        ],
      },
    ],
  };
}
