import type { TreatmentType } from "@prisma/client";
import type { TranslationKey } from "@/lib/i18n/translations";

/** Canonical treatment types — extend the Prisma enum here when new types are added. */
export const TREATMENT_TYPE_VALUES = [
  "DEWORMING",
  "DIPPING",
  "ANTIBIOTIC",
  "OTHER",
] as const satisfies readonly TreatmentType[];

export function treatmentTypeKey(type: string): TranslationKey {
  switch (type) {
    case "DEWORMING":
      return "deworming";
    case "DIPPING":
      return "dipping";
    case "ANTIBIOTIC":
      return "antibiotic";
    default:
      return "other";
  }
}

export function isTreatmentType(value: string): value is TreatmentType {
  return (TREATMENT_TYPE_VALUES as readonly string[]).includes(value);
}
