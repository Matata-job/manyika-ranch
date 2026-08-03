import type { TranslationKey } from "@/lib/i18n/translations";

export type HerdLifecycleStatus =
  | "ACTIVE"
  | "DECEASED"
  | "SOLD"
  | "MISSING"
  | "QUARANTINE"
  | string;

/** i18n key for animal herd status badge / filters. */
export function animalStatusLabelKey(status: HerdLifecycleStatus): TranslationKey {
  switch (status) {
    case "ACTIVE":
      return "statusActive";
    case "DECEASED":
      return "deceased";
    case "SOLD":
      return "statusSold";
    case "MISSING":
      return "statusMissing";
    case "QUARANTINE":
      return "quarantine";
    default:
      return "statusActive";
  }
}

export function animalStatusBadgeVariant(
  status: HerdLifecycleStatus
): "default" | "secondary" | "destructive" | "outline" | "warning" {
  switch (status) {
    case "DECEASED":
      return "destructive";
    case "SOLD":
      return "warning";
    case "QUARANTINE":
      return "warning";
    case "MISSING":
      return "secondary";
    case "ACTIVE":
    default:
      return "default";
  }
}
