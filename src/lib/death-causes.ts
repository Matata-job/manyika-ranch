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

function readCustomNameList(raw: unknown): string[] {
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

export function getCustomDeathCauses(settings: unknown): string[] {
  return readCustomNameList(
    (settings as { customDeathCauses?: unknown } | null)?.customDeathCauses
  );
}

export function getCustomDisposalMethods(settings: unknown): string[] {
  return readCustomNameList(
    (settings as { customDisposalMethods?: unknown } | null)
      ?.customDisposalMethods
  );
}

export function normalizeCustomDeathCauseName(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 80) return null;
  return trimmed;
}

export const normalizeCustomDisposalName = normalizeCustomDeathCauseName;

/** Form value: system enum or `custom:<name>` for ranch-added disposal. */
export function disposalFormValue(
  method: string,
  disposalNotes?: string | null
): string {
  if (method === "OTHER" && disposalNotes?.trim()) {
    return `custom:${disposalNotes.trim()}`;
  }
  return method;
}

export function parseDisposalFormValue(value: string): {
  method: DisposalMethodCode;
  disposalNotes: string | null;
} {
  if (value.startsWith("custom:")) {
    const name = value.slice("custom:".length).trim();
    return {
      method: "OTHER",
      disposalNotes: name || null,
    };
  }
  const method = (DISPOSAL_METHODS.includes(value as DisposalMethodCode)
    ? value
    : "BURIED") as DisposalMethodCode;
  return { method, disposalNotes: null };
}

export function isKnownDisposalFormValue(value: string): boolean {
  if (DISPOSAL_METHODS.includes(value as DisposalMethodCode)) return true;
  return value.startsWith("custom:") && Boolean(value.slice("custom:".length).trim());
}

const CAUSE_EN: Record<string, string> = {
  DISEASE: "Disease",
  INJURY: "Injury",
  PREDATION: "Predation",
  DROUGHT_STARVATION: "Drought / starvation",
  BIRTHING: "Birthing complications",
  OLD_AGE: "Old age",
  CULLING: "Cull (kuchinja)",
  UNKNOWN: "Unknown",
  OTHER: "Other",
};

const DISPOSAL_EN: Record<string, string> = {
  BURIED: "Buried",
  BURNED: "Burned",
  SOLD_CARCASS: "Sold carcass",
  REMOVED: "Removed",
  HOME_USE: "Home use (family slaughter)",
  CAMP_USE: "Camp use (camp slaughter)",
  USED_FOR_FOOD: "Used for food",
  OTHER: "Other",
};

export function formatCauseLabelEn(
  cause: string,
  causeDetail?: string | null
): string {
  if (cause === "OTHER" && causeDetail?.trim()) return causeDetail.trim();
  return CAUSE_EN[cause] || cause.replace(/_/g, " ");
}

export function formatDisposalLabelEn(
  method: string,
  disposalNotes?: string | null
): string {
  if (method === "OTHER" && disposalNotes?.trim()) return disposalNotes.trim();
  return DISPOSAL_EN[method] || method.replace(/_/g, " ");
}

export function animalEventTypeLabelKey(
  type: string
): TranslationKey | null {
  if (type === "CULLING") return "eventTypeSlaughter";
  if (type === "DEATH") return "eventTypeDeath";
  return null;
}

export function formatMortalityEventDescription(opts: {
  cause: string;
  causeDetail?: string | null;
  disposalMethod: string;
  disposalNotes?: string | null;
  isCulling: boolean;
  extra?: Array<string | null | undefined>;
}): string {
  return [
    opts.isCulling ? "Slaughter" : "Death",
    `Cause: ${formatCauseLabelEn(opts.cause, opts.causeDetail)}`,
    `Disposal: ${formatDisposalLabelEn(opts.disposalMethod, opts.disposalNotes)}`,
    ...(opts.extra || []),
  ]
    .filter(Boolean)
    .join(" · ");
}
