import type { TranslationKey } from "@/lib/i18n/translations";

export const SYSTEM_DEATH_CAUSES = [
  "DISEASE",
  "INJURY",
  "PREDATION",
  "DROUGHT_STARVATION",
  "BIRTHING",
  "OLD_AGE",
  "CULLING",
  "UNKNOWN",
  "OTHER",
] as const;

export type SystemDeathCause = (typeof SYSTEM_DEATH_CAUSES)[number];

export const DISPOSAL_METHODS = [
  "BURIED",
  "BURNED",
  "SOLD_CARCASS",
  "REMOVED",
  "HOME_USE",
  "CAMP_USE",
  "USED_FOR_FOOD",
  "OTHER",
] as const;

export type DisposalMethodCode = (typeof DISPOSAL_METHODS)[number];

/** Form value: system enum or `custom:<name>` for ranch-added causes. */
export function deathCauseFormValue(
  cause: string,
  causeDetail?: string | null
): string {
  if (cause === "OTHER" && causeDetail?.trim()) {
    return `custom:${causeDetail.trim()}`;
  }
  return cause;
}

export function parseDeathCauseFormValue(value: string): {
  cause: SystemDeathCause;
  causeDetail: string | null;
  isCulling: boolean;
} {
  if (value.startsWith("custom:")) {
    const name = value.slice("custom:".length).trim();
    return {
      cause: "OTHER",
      causeDetail: name || null,
      isCulling: false,
    };
  }
  const cause = (SYSTEM_DEATH_CAUSES.includes(value as SystemDeathCause)
    ? value
    : "UNKNOWN") as SystemDeathCause;
  return {
    cause,
    causeDetail: null,
    isCulling: cause === "CULLING",
  };
}

export function deathCauseKey(cause: string): TranslationKey {
  switch (cause) {
    case "DISEASE":
      return "illness";
    case "INJURY":
      return "injury";
    case "PREDATION":
      return "causePredation";
    case "DROUGHT_STARVATION":
      return "causeDroughtStarvation";
    case "BIRTHING":
      return "causeBirthing";
    case "OLD_AGE":
      return "causeOldAge";
    case "CULLING":
      return "causeCulling";
    case "UNKNOWN":
      return "causeUnknown";
    default:
      return "other";
  }
}

export function disposalMethodKey(method: string): TranslationKey {
  switch (method) {
    case "BURIED":
      return "disposalBuried";
    case "BURNED":
      return "disposalBurned";
    case "SOLD_CARCASS":
      return "disposalSoldCarcass";
    case "REMOVED":
      return "disposalRemoved";
    case "HOME_USE":
      return "disposalHomeUse";
    case "CAMP_USE":
      return "disposalCampUse";
    case "USED_FOR_FOOD":
      return "disposalUsedForFood";
    default:
      return "other";
  }
}

export function getCustomDeathCauses(settings: unknown): string[] {
  const raw = (settings as { customDeathCauses?: unknown } | null)
    ?.customDeathCauses;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function normalizeCustomDeathCauseName(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 80) return null;
  return trimmed;
}
