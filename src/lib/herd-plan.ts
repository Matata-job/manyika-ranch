import type { TranslationKey } from "@/lib/i18n/translations";

export const HERD_PLANS = [
  "EXCLUDED",
  "KEEP_BREEDING",
  "SELL_NEXT_CYCLE",
  "KULIMA",
] as const;

export type HerdPlanValue = (typeof HERD_PLANS)[number];

/** Fallback default note (EN). Prefer `t("herdPlanKulimaDefaultNote")` in UI. */
export const KULIMA_DEFAULT_NOTE = "Ploughing";

/** Min age (months) for mating dam/sire and “suggested breeding stock”. */
export const BREEDING_ELIGIBLE_MONTHS = 22;

export function isHerdPlan(value: unknown): value is HerdPlanValue {
  return (
    typeof value === "string" &&
    (HERD_PLANS as readonly string[]).includes(value)
  );
}

/** True when age is known and ≥ breeding-eligible months. */
export function isBreedingEligibleAge(
  ageMonths: number | null | undefined
): boolean {
  return (
    ageMonths != null &&
    Number.isFinite(ageMonths) &&
    ageMonths >= BREEDING_ELIGIBLE_MONTHS
  );
}

export function isKulimaPlan(
  plan: HerdPlanValue | string | null | undefined
): boolean {
  return plan === "KULIMA";
}

export function herdPlanLabelKey(plan: HerdPlanValue): TranslationKey {
  switch (plan) {
    case "KEEP_BREEDING":
      return "herdPlanKeepBreeding";
    case "SELL_NEXT_CYCLE":
      return "herdPlanSellNextCycle";
    case "KULIMA":
      return "herdPlanKulima";
    default:
      return "herdPlanExcluded";
  }
}

export function herdPlanBadgeVariant(
  plan: HerdPlanValue
): "success" | "warning" | "secondary" | "default" {
  switch (plan) {
    case "KEEP_BREEDING":
      return "success";
    case "SELL_NEXT_CYCLE":
      return "warning";
    case "KULIMA":
      return "default";
    default:
      return "secondary";
  }
}

/** Filter pill / dropdown options: all + each plan. */
export function herdPlanFilterOptions(
  t: (key: TranslationKey) => string
): { value: string; label: string }[] {
  return [
    { value: "all", label: t("all") },
    { value: "EXCLUDED", label: t("herdPlanExcluded") },
    { value: "KEEP_BREEDING", label: t("herdPlanKeepBreeding") },
    { value: "SELL_NEXT_CYCLE", label: t("herdPlanSellNextCycle") },
    { value: "KULIMA", label: t("herdPlanKulima") },
  ];
}
