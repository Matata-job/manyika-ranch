import type { TranslationKey } from "@/lib/i18n/translations";
import {
  isKnownDisposalFormValue,
  normalizeDisposalMethod,
} from "@/lib/death-causes";

export type MortalityPreset = {
  id: string;
  label: string;
  causeValue?: string;
  /** System enum or `custom:name`. */
  disposalMethod: string;
  isCulling: boolean;
};

/** @deprecated use MortalityPreset */
export type CustomMortalityPreset = MortalityPreset;

export const DEFAULT_MORTALITY_PRESETS: MortalityPreset[] = [
  {
    id: "sys:slaughter_food",
    label: "Slaughter — used for food",
    causeValue: "CULLING",
    disposalMethod: "USED_FOR_FOOD",
    isCulling: true,
  },
  {
    id: "sys:died_used_food",
    label: "Died — used for food",
    disposalMethod: "USED_FOR_FOOD",
    isCulling: false,
  },
  {
    id: "sys:died_buried",
    label: "Died — buried",
    disposalMethod: "BURIED",
    isCulling: false,
  },
];

const DEFAULT_PRESET_LABEL_KEYS: Record<string, TranslationKey> = {
  "sys:slaughter_food": "mortalityPresetSlaughterUsedFood",
  "sys:died_used_food": "mortalityPresetDiedUsedFood",
  "sys:died_buried": "mortalityPresetDiedBuried",
};

const DEFAULT_PRESET_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_MORTALITY_PRESETS.map((p) => [p.id, p.label])
);

export function mortalityPresetLabel(
  preset: MortalityPreset,
  t: (key: TranslationKey) => string
): string {
  const key = DEFAULT_PRESET_LABEL_KEYS[preset.id];
  if (key && preset.label === DEFAULT_PRESET_LABELS[preset.id]) {
    return t(key);
  }
  return preset.label;
}

export function getRanchMortalityPresets(settings: unknown): MortalityPreset[] {
  const raw = (settings as { mortalityPresets?: unknown } | null)?.mortalityPresets;
  if (!Array.isArray(raw)) {
    return DEFAULT_MORTALITY_PRESETS.map((p) => ({ ...p }));
  }
  const out: MortalityPreset[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const disposalMethod = row.disposalMethod;
    if (!id || !label || typeof disposalMethod !== "string") continue;
    if (!isKnownDisposalFormValue(disposalMethod)) continue;
    out.push({
      id,
      label,
      causeValue:
        typeof row.causeValue === "string" && row.causeValue
          ? row.causeValue
          : undefined,
      disposalMethod: normalizeDisposalMethod(disposalMethod),
      isCulling: Boolean(row.isCulling),
    });
  }
  if (!out.some((p) => p.id.startsWith("sys:"))) {
    return [...DEFAULT_MORTALITY_PRESETS.map((p) => ({ ...p })), ...out];
  }
  return out;
}

/** @deprecated use getRanchMortalityPresets */
export const getCustomMortalityPresets = getRanchMortalityPresets;

export function findPresetById(
  id: string,
  presets: MortalityPreset[]
): MortalityPreset | null {
  return presets.find((p) => p.id === id) ?? null;
}

export function remapCustomPresets(
  presets: MortalityPreset[],
  field: "causeValue" | "disposalMethod",
  oldValue: string,
  newValue: string | null
): MortalityPreset[] {
  return presets.map((p) => {
    if (p[field] !== oldValue) return p;
    if (field === "causeValue") {
      return { ...p, causeValue: newValue || undefined };
    }
    if (!newValue) return p;
    return { ...p, disposalMethod: newValue };
  });
}
