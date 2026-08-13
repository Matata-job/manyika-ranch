import type { TranslationKey } from "@/lib/i18n/translations";

export const SYSTEM_EXPENSE_CATEGORIES = [
  "FEED",
  "VET_MEDICINE",
  "WAGES",
  "TRANSPORT",
  "EQUIPMENT",
  "MAINTENANCE",
  "FUEL",
  "WATER",
  "INSURANCE",
  "OTHER",
] as const;

export type SystemExpenseCategory = (typeof SYSTEM_EXPENSE_CATEGORIES)[number];

export const DEFAULT_EXPENSE_UNITS = [
  "kg",
  "bags",
  "L",
  "pieces",
  "days",
  "hours",
  "trips",
  "bales",
  "tons",
] as const;

export function isSystemExpenseCategory(
  value: string
): value is SystemExpenseCategory {
  return (SYSTEM_EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function expenseCategoryLabelKey(c: string): TranslationKey {
  switch (c) {
    case "FEED":
      return "catFeed";
    case "VET_MEDICINE":
      return "catVetMedicine";
    case "WAGES":
      return "catWages";
    case "TRANSPORT":
      return "transport";
    case "EQUIPMENT":
      return "catEquipment";
    case "MAINTENANCE":
      return "catMaintenance";
    case "FUEL":
      return "catFuel";
    case "WATER":
      return "catWater";
    case "INSURANCE":
      return "catInsurance";
    default:
      return "other";
  }
}

function cleanStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const s = item.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function getCustomExpenseCategories(settings: unknown): string[] {
  return cleanStringList(
    (settings as { customExpenseCategories?: unknown } | null)
      ?.customExpenseCategories
  );
}

export function getCustomExpenseUnits(settings: unknown): string[] {
  return cleanStringList(
    (settings as { customExpenseUnits?: unknown } | null)?.customExpenseUnits
  );
}

/** Resolve display name for an expense row. */
export function expenseCategoryDisplayName(
  category: string,
  categoryDetail: string | null | undefined,
  t: (key: TranslationKey) => string
): string {
  if (category === "OTHER" && categoryDetail?.trim()) {
    return categoryDetail.trim();
  }
  return t(expenseCategoryLabelKey(category));
}

/**
 * Form / API: system code or custom:Name.
 * Persists as OTHER + categoryDetail for custom names.
 */
export function parseExpenseCategorySelection(value: string): {
  category: SystemExpenseCategory;
  categoryDetail: string | null;
} {
  const v = value.trim();
  if (v.startsWith("custom:")) {
    const name = v.slice("custom:".length).trim();
    return { category: "OTHER", categoryDetail: name || null };
  }
  if (isSystemExpenseCategory(v)) {
    return {
      category: v,
      categoryDetail: null,
    };
  }
  // Bare custom name
  return { category: "OTHER", categoryDetail: v || null };
}

export function expenseCategoryFormValue(
  category: string,
  categoryDetail: string | null | undefined
): string {
  if (category === "OTHER" && categoryDetail?.trim()) {
    return `custom:${categoryDetail.trim()}`;
  }
  return category;
}

/** Grouping key for P&L — custom OTHER uses detail name. */
export function expenseCategoryGroupKey(
  category: string,
  categoryDetail: string | null | undefined
): string {
  if (category === "OTHER" && categoryDetail?.trim()) {
    return categoryDetail.trim();
  }
  return category;
}

export const EXPENSE_FUNDING_SOURCES = ["OPERATING", "PROJECT"] as const;
export type ExpenseFundingSourceCode = (typeof EXPENSE_FUNDING_SOURCES)[number];

export const EXPENSE_ALLOC_GROUPS = [
  "NONE",
  "ALL_ACTIVE",
  "SELL_NEXT_CYCLE",
  "KEEP_BREEDING",
  "KULIMA",
] as const;
export type ExpenseAllocGroupCode = (typeof EXPENSE_ALLOC_GROUPS)[number];

export function isExpenseFundingSource(
  value: string
): value is ExpenseFundingSourceCode {
  return (EXPENSE_FUNDING_SOURCES as readonly string[]).includes(value);
}

export function isExpenseAllocGroup(
  value: string
): value is ExpenseAllocGroupCode {
  return (EXPENSE_ALLOC_GROUPS as readonly string[]).includes(value);
}

export function parseExpenseFundingSource(
  value: unknown
): ExpenseFundingSourceCode {
  const v = typeof value === "string" ? value.trim().toUpperCase() : "";
  return isExpenseFundingSource(v) ? v : "OPERATING";
}

export function defaultAllocGroup(
  category: string,
  funding: ExpenseFundingSourceCode
): ExpenseAllocGroupCode {
  if (funding === "PROJECT") return "NONE";
  if (category === "FEED") return "ALL_ACTIVE";
  return "NONE";
}

export function parseExpenseAllocGroup(
  value: unknown,
  category: string,
  funding: ExpenseFundingSourceCode
): ExpenseAllocGroupCode {
  if (funding === "PROJECT") return "NONE";
  if (typeof value === "string" && isExpenseAllocGroup(value.trim().toUpperCase())) {
    const g = value.trim().toUpperCase() as ExpenseAllocGroupCode;
    return g;
  }
  return defaultAllocGroup(category, funding);
}

export function expenseFundingLabelKey(
  source: string
): TranslationKey {
  return source === "PROJECT" ? "fundingProject" : "fundingOperating";
}

export function expenseAllocLabelKey(group: string): TranslationKey {
  switch (group) {
    case "ALL_ACTIVE":
      return "allocAllActive";
    case "SELL_NEXT_CYCLE":
      return "allocSellNextCycle";
    case "KEEP_BREEDING":
      return "allocKeepBreeding";
    case "KULIMA":
      return "allocKulima";
    default:
      return "allocNone";
  }
}
