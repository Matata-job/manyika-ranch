import type { TranslationKey } from "@/lib/i18n/translations";

export const HERD_PLANS = [
  "EXCLUDED",
  "KEEP_BREEDING",
  "SELL_NEXT_CYCLE",
] as const;

export type HerdPlanValue = (typeof HERD_PLANS)[number];

export function isHerdPlan(value: unknown): value is HerdPlanValue {
  return (
    typeof value === "string" &&
    (HERD_PLANS as readonly string[]).includes(value)
  );
}

export function herdPlanLabelKey(plan: HerdPlanValue): TranslationKey {
  switch (plan) {
    case "KEEP_BREEDING":
      return "herdPlanKeepBreeding";
    case "SELL_NEXT_CYCLE":
      return "herdPlanSellNextCycle";
    default:
      return "herdPlanExcluded";
  }
}

export function herdPlanBadgeVariant(
  plan: HerdPlanValue
): "success" | "warning" | "secondary" {
  switch (plan) {
    case "KEEP_BREEDING":
      return "success";
    case "SELL_NEXT_CYCLE":
      return "warning";
    default:
      return "secondary";
  }
}
