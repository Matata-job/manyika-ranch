"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/components/providers/locale-provider";
import {
  deathCauseKey,
  DISPOSAL_METHODS,
  disposalMethodKey,
  SYSTEM_DEATH_CAUSES,
} from "@/lib/death-causes";
import {
  findPresetById,
  SYSTEM_MORTALITY_PRESETS,
  type CustomMortalityPreset,
} from "@/lib/mortality-presets";
import type { TranslationKey } from "@/lib/i18n/translations";
import { Trash2 } from "lucide-react";

type Props = {
  onChanged?: () => void;
};

export function MortalitySetupPanel({ onChanged }: Props) {
  const t = useT();
  const [customCauses, setCustomCauses] = useState<string[]>([]);
  const [customPresets, setCustomPresets] = useState<CustomMortalityPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPreset, setNewPreset] = useState({
    label: "",
    causeValue: "",
    disposalMethod: "BURIED",
    isCulling: false,
  });
  const [savingPreset, setSavingPreset] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [causesRes, presetsRes] = await Promise.all([
        fetch("/api/mortality/causes"),
        fetch("/api/mortality/presets"),
      ]);
      if (causesRes.ok) {
        const data = await causesRes.json();
        setCustomCauses(data.custom || []);
      }
      if (presetsRes.ok) {
        const data = await presetsRes.json();
        setCustomPresets(data.custom || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteCause(name: string) {
    if (!window.confirm(t("confirmDeleteDeathCause", { name }))) return;
    const res = await fetch(
      `/api/mortality/causes?name=${encodeURIComponent(name)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("deleteDeathCauseFailed"));
      return;
    }
    const data = await res.json();
    setCustomCauses(data.custom || []);
    onChanged?.();
  }

  async function deletePreset(id: string, label: string) {
    if (!window.confirm(t("confirmDeleteMortalityPreset", { name: label }))) return;
    const res = await fetch(
      `/api/mortality/presets?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("deleteMortalityPresetFailed"));
      return;
    }
    const data = await res.json();
    setCustomPresets(data.custom || []);
    onChanged?.();
  }

  async function addPreset(e: React.FormEvent) {
    e.preventDefault();
    const label = newPreset.label.trim();
    if (!label) return;
    setSavingPreset(true);
    const res = await fetch("/api/mortality/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        causeValue: newPreset.causeValue || undefined,
        disposalMethod: newPreset.disposalMethod,
        isCulling: newPreset.isCulling,
      }),
    });
    setSavingPreset(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("addMortalityPresetFailed"));
      return;
    }
    const data = await res.json();
    setCustomPresets(data.custom || []);
    setNewPreset({
      label: "",
      causeValue: "",
      disposalMethod: "BURIED",
      isCulling: false,
    });
    onChanged?.();
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("loading")}</p>
    );
  }

  return (
    <div className="space-y-6 rounded-md border p-4 bg-muted/20">
      <div>
        <h3 className="font-medium">{t("mortalitySetupTitle")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("mortalitySetupHelp")}
        </p>
      </div>

      <div className="space-y-2">
        <Label>{t("customDeathCauses")}</Label>
        {customCauses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCustomDeathCauses")}</p>
        ) : (
          <ul className="space-y-1">
            {customCauses.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-2 text-sm"
              >
                <span>{name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteCause(name)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{t("delete")}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t("builtInMortalityPresets")}</Label>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {SYSTEM_MORTALITY_PRESETS.map((p) => (
            <li key={p.id} className="rounded border bg-background px-3 py-2">
              {t(p.labelKey)}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <Label>{t("customMortalityPresets")}</Label>
        {customPresets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCustomMortalityPresets")}</p>
        ) : (
          <ul className="space-y-1">
            {customPresets.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-2 text-sm"
              >
                <span>
                  {p.label}
                  <span className="text-muted-foreground ml-2">
                    · {t(disposalMethodKey(p.disposalMethod))}
                    {p.isCulling ? ` · ${t("cullShort")}` : ""}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deletePreset(p.id, p.label)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{t("delete")}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={addPreset} className="space-y-3 border-t pt-4">
        <Label>{t("addCustomMortalityPreset")}</Label>
        <Input
          placeholder={t("mortalityPresetLabelPlaceholder")}
          value={newPreset.label}
          onChange={(e) => setNewPreset({ ...newPreset, label: e.target.value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            value={newPreset.causeValue || "__none__"}
            onValueChange={(v) =>
              setNewPreset({
                ...newPreset,
                causeValue: v === "__none__" ? "" : v,
                isCulling: v === "CULLING" ? true : newPreset.isCulling,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("presetCauseOptional")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("presetCauseOptional")}</SelectItem>
              {SYSTEM_DEATH_CAUSES.filter((c) => c !== "OTHER").map((c) => (
                <SelectItem key={c} value={c}>
                  {t(deathCauseKey(c))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={newPreset.disposalMethod}
            onValueChange={(v) =>
              setNewPreset({ ...newPreset, disposalMethod: v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISPOSAL_METHODS.map((d) => (
                <SelectItem key={d} value={d}>
                  {t(disposalMethodKey(d))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={newPreset.isCulling}
            onChange={(e) =>
              setNewPreset({ ...newPreset, isCulling: e.target.checked })
            }
          />
          {t("markAsCulling")}
        </label>
        <Button type="submit" size="sm" disabled={savingPreset || !newPreset.label.trim()}>
          {savingPreset ? t("saving") : t("addPreset")}
        </Button>
      </form>
    </div>
  );
}

export function useMortalityPresets() {
  const t = useT();
  const [customPresets, setCustomPresets] = useState<CustomMortalityPreset[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    return fetch("/api/mortality/presets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.custom) setCustomPresets(d.custom);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function presetLabel(id: string): string {
    if (id === "__none__") return t("mortalityPresetManual");
    const system = SYSTEM_MORTALITY_PRESETS.find((p) => p.id === id);
    if (system) return t(system.labelKey);
    const custom = customPresets.find((p) => p.id === id);
    return custom?.label ?? id;
  }

  function applyPresetId(
    id: string,
    handlers: {
      setCauseValue: (v: string) => void;
      setDisposalMethod: (v: string) => void;
      setIsCulling: (v: boolean) => void;
    }
  ) {
    if (id === "__none__") return;
    const preset = findPresetById(id, customPresets);
    if (!preset) return;
    if (preset.causeValue) handlers.setCauseValue(preset.causeValue);
    handlers.setDisposalMethod(preset.disposalMethod);
    handlers.setIsCulling(preset.isCulling);
  }

  return {
    customPresets,
    loaded,
    reload,
    presetLabel,
    applyPresetId,
    systemPresets: SYSTEM_MORTALITY_PRESETS,
  };
}

export type MortalityPresetOption = {
  id: string;
  label: string;
};

export function buildMortalityPresetOptions(
  t: (key: TranslationKey) => string,
  customPresets: CustomMortalityPreset[]
): MortalityPresetOption[] {
  return [
    { id: "__none__", label: t("mortalityPresetManual") },
    ...SYSTEM_MORTALITY_PRESETS.map((p) => ({
      id: p.id,
      label: t(p.labelKey),
    })),
    ...customPresets.map((p) => ({ id: p.id, label: p.label })),
  ];
}
