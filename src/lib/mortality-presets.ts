import type { TranslationKey } from "@/lib/i18n/translations";
import type { DisposalMethodCode } from "@/lib/death-causes";

export type MortalityPresetConfig = {
  id: string;
  labelKey: TranslationKey;
  /** System enum or `custom:name` — omit to leave cause unchanged when applied */
  causeValue?: string;
  disposalMethod: DisposalMethodCode;
  isCulling: boolean;
  system: true;
};

export const SYSTEM_MORTALITY_PRESETS: MortalityPresetConfig[] = [
  {
    id: "sys:family_slaughter",
    labelKey: "mortalityPresetFamilySlaughter",
    causeValue: "CULLING",
    disposalMethod: "HOME_USE",
    isCulling: true,
    system: true,
  },
  {
    id: "sys:camp_slaughter",
    labelKey: "mortalityPresetCampSlaughter",
    causeValue: "CULLING",
    disposalMethod: "CAMP_USE",
    isCulling: true,
    system: true,
  },
  {
    id: "sys:died_used_food",
    labelKey: "mortalityPresetDiedUsedFood",
    disposalMethod: "USED_FOR_FOOD",
    isCulling: false,
    system: true,
  },
  {
    id: "sys:died_buried",
    labelKey: "mortalityPresetDiedBuried",
    disposalMethod: "BURIED",
    isCulling: false,
    system: true,
  },
];

export type CustomMortalityPreset = {
  id: string;
  label: string;
  causeValue?: string;
  disposalMethod: DisposalMethodCode;
  isCulling: boolean;
};

export function getCustomMortalityPresets(settings: unknown): CustomMortalityPreset[] {
  const raw = (settings as { mortalityPresets?: unknown } | null)?.mortalityPresets;
  if (!Array.isArray(raw)) return [];
  const out: CustomMortalityPreset[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const disposalMethod = row.disposalMethod;
    if (!id || !label || typeof disposalMethod !== "string") continue;
    out.push({
      id,
      label,
      causeValue:
        typeof row.causeValue === "string" && row.causeValue
          ? row.causeValue
          : undefined,
      disposalMethod: disposalMethod as DisposalMethodCode,
      isCulling: Boolean(row.isCulling),
    });
  }
  return out;
}

export function findPresetById(
  id: string,
  custom: CustomMortalityPreset[]
): MortalityPresetConfig | CustomMortalityPreset | null {
  const system = SYSTEM_MORTALITY_PRESETS.find((p) => p.id === id);
  if (system) return system;
  return custom.find((p) => p.id === id) ?? null;
}
