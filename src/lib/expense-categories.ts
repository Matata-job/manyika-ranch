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
