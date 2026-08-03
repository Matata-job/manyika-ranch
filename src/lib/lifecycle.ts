import { BREEDING_ELIGIBLE_MONTHS } from "@/lib/herd-plan";
import type { TranslationKey } from "@/lib/i18n/translations";

export type LifecycleKind =
  | "calf"
  | "heifer"
  | "cow"
  | "bull_calf"
  | "bull"
  | "steer"
  | "unknown";

/** Classic ranch lifecycle label from sex, age, and castration — display only. */
export function lifecycleKind(input: {
  sex: string;
  ageMonths?: number | null;
  isCastrated?: boolean | null;
}): LifecycleKind {
  const age = input.ageMonths;
  const young =
    age == null || !Number.isFinite(age) || age < BREEDING_ELIGIBLE_MONTHS;

  if (input.sex === "FEMALE") {
    if (young) return age != null && age < 12 ? "calf" : "heifer";
    return "cow";
  }
  if (input.sex === "MALE") {
    if (input.isCastrated) return "steer";
    if (young) return "bull_calf";
    return "bull";
  }
  return "unknown";
}

export function lifecycleLabelKey(kind: LifecycleKind): TranslationKey {
  switch (kind) {
    case "calf":
      return "lifecycleCalf";
    case "heifer":
      return "lifecycleHeifer";
    case "cow":
      return "lifecycleCow";
    case "bull_calf":
      return "lifecycleBullCalf";
    case "bull":
      return "lifecycleBull";
    case "steer":
      return "lifecycleSteer";
    default:
      return "unknownSex";
  }
}
