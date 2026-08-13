/** Format a Date as YYYY-MM-DD in local calendar. */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type MonthPreset =
  | "all_time"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "this_year"
  | "last_year"
  | "custom";

export function rangeForMonthPreset(preset: MonthPreset): {
  from: string;
  to: string;
} {
  const now = new Date();
  const to = toDateInputValue(now);

  if (preset === "all_time") {
    return { from: "", to: "" };
  }
  if (preset === "this_month") {
    return {
      from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
      to,
    };
  }
  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toDateInputValue(start), to: toDateInputValue(end) };
  }
  if (preset === "last_3_months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from: toDateInputValue(start), to };
  }
  if (preset === "this_year") {
    return {
      from: toDateInputValue(new Date(now.getFullYear(), 0, 1)),
      to,
    };
  }
  if (preset === "last_year") {
    const y = now.getFullYear() - 1;
    return {
      from: toDateInputValue(new Date(y, 0, 1)),
      to: toDateInputValue(new Date(y, 11, 31)),
    };
  }
  return { from: "", to: "" };
}

/** Inclusive day range for Prisma DateTime filters (UTC end-of-day). */
export function prismaDateRange(
  from: string | null | undefined,
  to: string | null | undefined
): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };
}
