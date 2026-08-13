"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { AnimalActivityPicker } from "@/components/animals/animal-activity-picker";
import type { PickerAnimal } from "@/components/animals/animal-activity-picker";
import { SelectedAnimalsList } from "@/components/animals/selected-animals-list";
import { DeathCausePicker } from "@/components/animals/death-cause-picker";
import { DisposalMethodPicker } from "@/components/animals/disposal-method-picker";
import {
  buildMortalityPresetOptions,
  useMortalityPresets,
} from "@/components/animals/mortality-setup-panel";
import { SuccessDialog } from "@/components/success-dialog";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import {
  deathCauseKey,
  parseDeathCauseFormValue,
  parseDisposalFormValue,
} from "@/lib/death-causes";

export default function DeadAnimalRecordPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManageMortality = role ? hasPermission(role, "manageMortality") : false;

  const { customPresets, applyPresetId } = useMortalityPresets();
  const presetOptions = buildMortalityPresetOptions(t, customPresets);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [animalById, setAnimalById] = useState<Map<string, PickerAnimal>>(
    new Map()
  );
  const [saving, setSaving] = useState(false);
  const [presetId, setPresetId] = useState("__none__");
  const [causeValue, setCauseValue] = useState("UNKNOWN");
  const [isCulling, setIsCulling] = useState(false);
  const [form, setForm] = useState({
    date: "",
    causeDetail: "",
    disposalMethod: "BURIED",
    disposalNotes: "",
    location: "",
    notes: "",
    insuranceClaim: false,
    claimAmountTzs: "",
    claimReference: "",
  });
  const [result, setResult] = useState<{
    recorded: number;
    skipped: number;
    isCulling: boolean;
  } | null>(null);

  function mergeAnimalsLoaded(animals: PickerAnimal[]) {
    setAnimalById((prev) => {
      const next = new Map(prev);
      animals.forEach((a) => next.set(a.id, a));
      return next;
    });
  }

  function selectPreset(id: string) {
    setPresetId(id);
    applyPresetId(id, {
      setCauseValue,
      setDisposalMethod: (v) => setForm((f) => ({ ...f, disposalMethod: v })),
      setIsCulling,
    }, causeValue);
  }

  function clearPreset() {
    setPresetId("__none__");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      window.alert(t("selectAtLeastOneAnimal"));
      return;
    }
    const parsed = parseDeathCauseFormValue(causeValue);
    const parsedDisposal = parseDisposalFormValue(form.disposalMethod);
    const causeLabel =
      parsed.cause === "OTHER" && parsed.causeDetail
        ? parsed.causeDetail
        : t(deathCauseKey(parsed.cause));
    if (
      !window.confirm(
        t("confirmBulkMortality", {
          n: selected.size,
          cause: causeLabel,
        })
      )
    ) {
      return;
    }

    const submitCulling = isCulling || parsed.isCulling;

    setSaving(true);
    setResult(null);
    const res = await fetch("/api/mortality/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalIds: [...selected],
        date: form.date || undefined,
        cause: parsed.cause,
        causeDetail:
          parsed.causeDetail || form.causeDetail.trim() || null,
        disposalMethod: parsedDisposal.method,
        disposalNotes:
          parsedDisposal.disposalNotes || form.disposalNotes.trim() || null,
        location: form.location || null,
        notes: form.notes || null,
        isCulling: submitCulling,
        insuranceClaim: form.insuranceClaim,
        claimAmountTzs: form.claimAmountTzs || null,
        claimReference: form.claimReference || null,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("bulkMortalityFailed"));
      return;
    }

    const data = await res.json();
    setResult({
      recorded: data.recorded,
      skipped: data.skipped,
      isCulling: data.isCulling,
    });
    setSelected(new Set());
    setCauseValue("UNKNOWN");
    setPresetId("__none__");
    setIsCulling(false);
    setForm({
      date: "",
      causeDetail: "",
      disposalMethod: "BURIED",
      disposalNotes: "",
      location: "",
      notes: "",
      insuranceClaim: false,
      claimAmountTzs: "",
      claimReference: "",
    });
  }

  return (
    <div className="space-y-6 max-w-5xl pb-8">
      <div>
        <Link
          href="/mortality"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("backToMortality")}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              {t("deadAnimalRecordTitle")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("deadAnimalRecordSelectHelp")}
            </p>
          </div>
          {canManageMortality && (
            <Button asChild variant="outline" size="sm">
              <Link href="/mortality/setup">{t("manageMortalitySetup")}</Link>
            </Button>
          )}
        </div>
      </div>

      {result && (
        <SuccessDialog
          open
          title={t("bulkMortalitySuccessTitle")}
          message={
            <>
              {result.isCulling
                ? t("bulkCullResult", { n: result.recorded })
                : t("bulkDeathResult", { n: result.recorded })}
              {result.skipped > 0 && (
                <> · {t("skippedInaccessible", { n: result.skipped })}</>
              )}
            </>
          }
          closeLabel={t("ok")}
          onClose={() => setResult(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("chooseAnimals")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AnimalActivityPicker
            selected={selected}
            onSelectedChange={(next) => {
              setSelected(next);
              setResult(null);
            }}
            onAnimalsLoaded={mergeAnimalsLoaded}
            storageKey="manyika.deadAnimal.columns"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("mortalityDetails")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("animalsSelectedCount", {
              selected: selected.size,
              total: selected.size,
            })}
          </p>
        </CardHeader>
        <CardContent>
          <SelectedAnimalsList selected={selected} animalById={animalById} />
          <form onSubmit={submit} className="space-y-4 max-w-2xl mt-4">
            <div className="space-y-2">
              <Label>{t("mortalityQuickPreset")}</Label>
              <Select value={presetId} onValueChange={selectPreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("mortalityQuickPresetHelp")}
              </p>
            </div>

            <DeathCausePicker
              value={causeValue}
              onChange={(v, meta) => {
                clearPreset();
                setCauseValue(v);
                setIsCulling(meta.isCulling);
                setForm((f) => ({
                  ...f,
                  causeDetail:
                    meta.cause === "OTHER" && meta.causeDetail
                      ? meta.causeDetail
                      : f.causeDetail,
                }));
              }}
            />

            {causeValue === "OTHER" && (
              <div className="space-y-2">
                <Label>{t("causeDetail")}</Label>
                <Input
                  value={form.causeDetail}
                  onChange={(e) => {
                    clearPreset();
                    setForm({ ...form, causeDetail: e.target.value });
                  }}
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <DisposalMethodPicker
                value={form.disposalMethod}
                onChange={(v) => {
                  clearPreset();
                  setForm((f) => ({ ...f, disposalMethod: v }));
                }}
              />
              <div className="space-y-2">
                <Label>{t("date")}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm({ ...form, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("location")}</Label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("disposalNotes")}</Label>
              <Input
                value={form.disposalNotes}
                onChange={(e) =>
                  setForm({ ...form, disposalNotes: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("notes")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
                rows={2}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.insuranceClaim}
                onChange={(e) =>
                  setForm({ ...form, insuranceClaim: e.target.checked })
                }
              />
              {t("insuranceClaim")}
            </label>
            {form.insuranceClaim && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("claimAmount")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.claimAmountTzs}
                    onChange={(e) =>
                      setForm({ ...form, claimAmountTzs: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("claimReference")}</Label>
                  <Input
                    value={form.claimReference}
                    onChange={(e) =>
                      setForm({ ...form, claimReference: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {t("bulkMortalityPhotoNote")}
            </p>

            <Button type="submit" disabled={saving || selected.size === 0}>
              {saving ? t("saving") : t("recordBulkMortality")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
