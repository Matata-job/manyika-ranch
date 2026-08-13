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
import { Pencil, Trash2 } from "lucide-react";

type Props = {
  onChanged?: () => void;
};

type PresetDraft = {
  label: string;
  causeValue: string;
  disposalMethod: string;
  isCulling: boolean;
};

const EMPTY_PRESET: PresetDraft = {
  label: "",
  causeValue: "",
  disposalMethod: "BURIED",
  isCulling: false,
};

function disposalLabel(
  value: string,
  t: (key: TranslationKey) => string
): string {
  if (value.startsWith("custom:")) return value.slice("custom:".length);
  return t(disposalMethodKey(value));
}

function causeLabel(value: string, t: (key: TranslationKey) => string): string {
  if (!value) return "";
  if (value.startsWith("custom:")) return value.slice("custom:".length);
  return t(deathCauseKey(value));
}

export function MortalitySetupPanel({ onChanged }: Props) {
  const t = useT();
  const [customCauses, setCustomCauses] = useState<string[]>([]);
  const [customDisposals, setCustomDisposals] = useState<string[]>([]);
  const [customPresets, setCustomPresets] = useState<CustomMortalityPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCause, setNewCause] = useState("");
  const [editingCause, setEditingCause] = useState<string | null>(null);
  const [causeDraft, setCauseDraft] = useState("");
  const [savingCause, setSavingCause] = useState(false);

  const [newDisposal, setNewDisposal] = useState("");
  const [editingDisposal, setEditingDisposal] = useState<string | null>(null);
  const [disposalDraft, setDisposalDraft] = useState("");
  const [savingDisposal, setSavingDisposal] = useState(false);

  const [newPreset, setNewPreset] = useState<PresetDraft>(EMPTY_PRESET);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetDraft, setPresetDraft] = useState<PresetDraft>(EMPTY_PRESET);
  const [savingPreset, setSavingPreset] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [causesRes, disposalsRes, presetsRes] = await Promise.all([
        fetch("/api/mortality/causes"),
        fetch("/api/mortality/disposals"),
        fetch("/api/mortality/presets"),
      ]);
      if (causesRes.ok) {
        const data = await causesRes.json();
        setCustomCauses(data.custom || []);
      }
      if (disposalsRes.ok) {
        const data = await disposalsRes.json();
        setCustomDisposals(data.custom || []);
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

  async function addNamed(
    url: string,
    name: string,
    failKey: TranslationKey
  ): Promise<string[] | null> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t(failKey));
      return null;
    }
    const data = await res.json();
    return data.custom || [];
  }

  async function renameNamed(
    url: string,
    name: string,
    newName: string,
    failKey: TranslationKey
  ): Promise<string[] | null> {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, newName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t(failKey));
      return null;
    }
    const data = await res.json();
    return data.custom || [];
  }

  async function deleteNamed(
    url: string,
    name: string,
    confirmKey: TranslationKey,
    failKey: TranslationKey
  ): Promise<string[] | null> {
    if (!window.confirm(t(confirmKey, { name }))) return null;
    const res = await fetch(`${url}?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t(failKey));
      return null;
    }
    const data = await res.json();
    return data.custom || [];
  }

  async function submitCause(e: React.FormEvent) {
    e.preventDefault();
    const name = newCause.trim();
    if (!name) return;
    setSavingCause(true);
    const next = await addNamed("/api/mortality/causes", name, "addDeathCauseFailed");
    setSavingCause(false);
    if (!next) return;
    setCustomCauses(next);
    setNewCause("");
    onChanged?.();
  }

  async function saveCauseRename(oldName: string) {
    const name = causeDraft.trim();
    if (!name || name === oldName) {
      setEditingCause(null);
      return;
    }
    setSavingCause(true);
    const next = await renameNamed(
      "/api/mortality/causes",
      oldName,
      name,
      "renameDeathCauseFailed"
    );
    setSavingCause(false);
    if (!next) return;
    setCustomCauses(next);
    setEditingCause(null);
    await load();
    onChanged?.();
  }

  async function submitDisposal(e: React.FormEvent) {
    e.preventDefault();
    const name = newDisposal.trim();
    if (!name) return;
    setSavingDisposal(true);
    const next = await addNamed(
      "/api/mortality/disposals",
      name,
      "addDisposalFailed"
    );
    setSavingDisposal(false);
    if (!next) return;
    setCustomDisposals(next);
    setNewDisposal("");
    onChanged?.();
  }

  async function saveDisposalRename(oldName: string) {
    const name = disposalDraft.trim();
    if (!name || name === oldName) {
      setEditingDisposal(null);
      return;
    }
    setSavingDisposal(true);
    const next = await renameNamed(
      "/api/mortality/disposals",
      oldName,
      name,
      "renameDisposalFailed"
    );
    setSavingDisposal(false);
    if (!next) return;
    setCustomDisposals(next);
    setEditingDisposal(null);
    await load();
    onChanged?.();
  }

  async function savePreset(body: Record<string, unknown>, isEdit: boolean) {
    setSavingPreset(true);
    const res = await fetch("/api/mortality/presets", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSavingPreset(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("addMortalityPresetFailed"));
      return false;
    }
    const data = await res.json();
    setCustomPresets(data.custom || []);
    onChanged?.();
    return true;
  }

  async function addPreset(e: React.FormEvent) {
    e.preventDefault();
    const label = newPreset.label.trim();
    if (!label) return;
    const ok = await savePreset(
      {
        label,
        causeValue: newPreset.causeValue || undefined,
        disposalMethod: newPreset.disposalMethod,
        isCulling: newPreset.isCulling,
      },
      false
    );
    if (ok) setNewPreset(EMPTY_PRESET);
  }

  async function savePresetEdit() {
    if (!editingPresetId) return;
    const label = presetDraft.label.trim();
    if (!label) return;
    const ok = await savePreset(
      {
        id: editingPresetId,
        label,
        causeValue: presetDraft.causeValue || "",
        disposalMethod: presetDraft.disposalMethod,
        isCulling: presetDraft.isCulling,
      },
      true
    );
    if (ok) setEditingPresetId(null);
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
    if (editingPresetId === id) setEditingPresetId(null);
    onChanged?.();
  }

  function CauseSelect({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <Select
        value={value || "__none__"}
        onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
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
          {customCauses.map((name) => (
            <SelectItem key={`custom:${name}`} value={`custom:${name}`}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function DisposalSelect({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DISPOSAL_METHODS.filter((d) => d !== "OTHER").map((d) => (
            <SelectItem key={d} value={d}>
              {t(disposalMethodKey(d))}
            </SelectItem>
          ))}
          {customDisposals.map((name) => (
            <SelectItem key={`custom:${name}`} value={`custom:${name}`}>
              {name}
            </SelectItem>
          ))}
          <SelectItem value="OTHER">{t("other")}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }

  return (
    <div className="space-y-6 rounded-md border p-4 bg-muted/20">
      <div>
        <h3 className="font-medium">{t("mortalitySetupTitle")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("mortalitySetupHelp")}
        </p>
      </div>

      <section className="space-y-2">
        <Label>{t("cause")} *</Label>
        <p className="text-xs text-muted-foreground">{t("builtInCauses")}: {SYSTEM_DEATH_CAUSES.filter((c) => c !== "OTHER").map((c) => t(deathCauseKey(c))).join(" · ")}</p>
        {customCauses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCustomDeathCauses")}</p>
        ) : (
          <ul className="space-y-1">
            {customCauses.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-2 text-sm"
              >
                {editingCause === name ? (
                  <div className="flex flex-1 flex-col sm:flex-row gap-2">
                    <Input
                      value={causeDraft}
                      onChange={(e) => setCauseDraft(e.target.value)}
                      disabled={savingCause}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveCauseRename(name)}
                        disabled={savingCause || !causeDraft.trim()}
                      >
                        {t("save")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingCause(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span>{name}</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingCause(name);
                          setCauseDraft(name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">{t("edit")}</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          const next = await deleteNamed(
                            "/api/mortality/causes",
                            name,
                            "confirmDeleteDeathCause",
                            "deleteDeathCauseFailed"
                          );
                          if (!next) return;
                          setCustomCauses(next);
                          await load();
                          onChanged?.();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">{t("delete")}</span>
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submitCause} className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder={t("newDeathCausePlaceholder")}
            value={newCause}
            onChange={(e) => setNewCause(e.target.value)}
            disabled={savingCause}
          />
          <Button type="submit" size="sm" disabled={savingCause || !newCause.trim()}>
            {savingCause ? t("saving") : t("addCustomCause")}
          </Button>
        </form>
      </section>

      <section className="space-y-2">
        <Label>{t("disposal")} *</Label>
        <p className="text-xs text-muted-foreground">{t("builtInDisposals")}: {DISPOSAL_METHODS.filter((d) => d !== "OTHER").map((d) => t(disposalMethodKey(d))).join(" · ")}</p>
        {customDisposals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCustomDisposals")}</p>
        ) : (
          <ul className="space-y-1">
            {customDisposals.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-2 text-sm"
              >
                {editingDisposal === name ? (
                  <div className="flex flex-1 flex-col sm:flex-row gap-2">
                    <Input
                      value={disposalDraft}
                      onChange={(e) => setDisposalDraft(e.target.value)}
                      disabled={savingDisposal}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveDisposalRename(name)}
                        disabled={savingDisposal || !disposalDraft.trim()}
                      >
                        {t("save")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingDisposal(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span>{name}</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingDisposal(name);
                          setDisposalDraft(name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">{t("edit")}</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          const next = await deleteNamed(
                            "/api/mortality/disposals",
                            name,
                            "confirmDeleteDisposal",
                            "deleteDisposalFailed"
                          );
                          if (!next) return;
                          setCustomDisposals(next);
                          await load();
                          onChanged?.();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">{t("delete")}</span>
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submitDisposal} className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder={t("newDisposalPlaceholder")}
            value={newDisposal}
            onChange={(e) => setNewDisposal(e.target.value)}
            disabled={savingDisposal}
          />
          <Button
            type="submit"
            size="sm"
            disabled={savingDisposal || !newDisposal.trim()}
          >
            {savingDisposal ? t("saving") : t("addCustomDisposal")}
          </Button>
        </form>
      </section>

      <section className="space-y-2">
        <Label>{t("builtInMortalityPresets")}</Label>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {SYSTEM_MORTALITY_PRESETS.map((p) => (
            <li key={p.id} className="rounded border bg-background px-3 py-2">
              {t(p.labelKey)}
              <span className="ml-2">
                · {p.isCulling ? t("recordKindSlaughter") : t("recordKindDeath")}
                {p.causeValue ? ` · ${causeLabel(p.causeValue, t)}` : ""}
                {` · ${disposalLabel(p.disposalMethod, t)}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <Label>{t("customMortalityPresets")}</Label>
        {customPresets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCustomMortalityPresets")}</p>
        ) : (
          <ul className="space-y-2">
            {customPresets.map((p) => (
              <li key={p.id} className="rounded border bg-background px-3 py-2 text-sm">
                {editingPresetId === p.id ? (
                  <div className="space-y-3">
                    <Input
                      value={presetDraft.label}
                      onChange={(e) =>
                        setPresetDraft({ ...presetDraft, label: e.target.value })
                      }
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <CauseSelect
                        value={presetDraft.causeValue}
                        onChange={(v) =>
                          setPresetDraft({
                            ...presetDraft,
                            causeValue: v,
                            isCulling: v === "CULLING" ? true : presetDraft.isCulling,
                          })
                        }
                      />
                      <DisposalSelect
                        value={presetDraft.disposalMethod}
                        onChange={(v) =>
                          setPresetDraft({ ...presetDraft, disposalMethod: v })
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={presetDraft.isCulling}
                        onChange={(e) =>
                          setPresetDraft({
                            ...presetDraft,
                            isCulling: e.target.checked,
                          })
                        }
                      />
                      {t("presetIsSlaughter")}
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={savePresetEdit}
                        disabled={savingPreset || !presetDraft.label.trim()}
                      >
                        {t("save")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingPresetId(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {p.label}
                      <span className="text-muted-foreground ml-2">
                        · {p.isCulling ? t("recordKindSlaughter") : t("recordKindDeath")}
                        {p.causeValue ? ` · ${causeLabel(p.causeValue, t)}` : ""}
                        {` · ${disposalLabel(p.disposalMethod, t)}`}
                      </span>
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingPresetId(p.id);
                          setPresetDraft({
                            label: p.label,
                            causeValue: p.causeValue || "",
                            disposalMethod: p.disposalMethod,
                            isCulling: p.isCulling,
                          });
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">{t("edit")}</span>
                      </Button>
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
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={addPreset} className="space-y-3 border-t pt-4">
        <Label>{t("addCustomMortalityPreset")}</Label>
        <Input
          placeholder={t("mortalityPresetLabelPlaceholder")}
          value={newPreset.label}
          onChange={(e) => setNewPreset({ ...newPreset, label: e.target.value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <CauseSelect
            value={newPreset.causeValue}
            onChange={(v) =>
              setNewPreset({
                ...newPreset,
                causeValue: v,
                isCulling: v === "CULLING" ? true : newPreset.isCulling,
              })
            }
          />
          <DisposalSelect
            value={newPreset.disposalMethod}
            onChange={(v) => setNewPreset({ ...newPreset, disposalMethod: v })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={newPreset.isCulling}
            onChange={(e) =>
              setNewPreset({ ...newPreset, isCulling: e.target.checked })
            }
          />
          {t("presetIsSlaughter")}
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
    },
    currentCause?: string
  ) {
    if (id === "__none__") return;
    const preset = findPresetById(id, customPresets);
    if (!preset) return;
    if (preset.causeValue) {
      handlers.setCauseValue(preset.causeValue);
    } else if (!preset.isCulling && currentCause === "CULLING") {
      handlers.setCauseValue("UNKNOWN");
    }
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
