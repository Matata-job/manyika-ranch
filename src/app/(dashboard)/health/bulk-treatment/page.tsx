"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { SuccessDialog } from "@/components/success-dialog";
import { AnimalActivityPicker } from "@/components/animals/animal-activity-picker";
import type { PickerAnimal } from "@/components/animals/animal-activity-picker";
import { SelectedAnimalsList } from "@/components/animals/selected-animals-list";
import { ChoicePills } from "@/components/choice-pills";
import { OptionalSection } from "@/components/optional-section";
import {
  buildHealthCatalog,
  CUSTOM_CATALOG_KEY,
  parseCatalogKey,
  type DoseKind,
  type HealthCatalogEntry,
} from "@/lib/health-catalog";
import {
  isTreatmentType,
  TREATMENT_TYPE_VALUES,
  treatmentTypeKey,
} from "@/lib/treatment-types";

export default function BulkTreatmentPage() {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [animalById, setAnimalById] = useState<Map<string, PickerAnimal>>(
    new Map()
  );
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<HealthCatalogEntry[]>([]);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [form, setForm] = useState({
    catalogKey: CUSTOM_CATALOG_KEY,
    doseKind: "treatment" as DoseKind,
    type: "DIPPING",
    product: "",
    dose: "",
    batchNo: "",
    withdrawalPeriod: "",
    date: "",
    notes: "",
    totalCostTzs: "",
  });
  const [result, setResult] = useState<{
    applied: number;
    skipped: number;
    doseKind: DoseKind;
  } | null>(null);

  const catalogByKey = useMemo(
    () => new Map(catalog.map((entry) => [entry.key, entry])),
    [catalog]
  );

  const treatmentCatalog = useMemo(
    () => catalog.filter((c) => c.kind === "treatment"),
    [catalog]
  );
  const vaccineCatalog = useMemo(
    () => catalog.filter((c) => c.kind === "vaccination"),
    [catalog]
  );

  const treatmentTypeOptions = useMemo(() => {
    const fromCatalog = new Set(
      treatmentCatalog
        .map((c) => c.type)
        .filter((type): type is (typeof TREATMENT_TYPE_VALUES)[number] =>
          type != null && isTreatmentType(type)
        )
    );
    for (const type of TREATMENT_TYPE_VALUES) fromCatalog.add(type);
    return [...fromCatalog].map((value) => ({
      value,
      label: t(treatmentTypeKey(value)),
    }));
  }, [t, treatmentCatalog]);

  const fromCatalog = form.catalogKey !== CUSTOM_CATALOG_KEY;
  const isVaccination = form.doseKind === "vaccination";

  useEffect(() => {
    Promise.all([
      fetch("/api/health/treatment-schedules").then((r) =>
        r.ok ? r.json() : []
      ),
      fetch("/api/health/vaccines").then((r) => (r.ok ? r.json() : [])),
    ]).then(([treatments, vaccines]) => {
      setCatalog(
        buildHealthCatalog(
          Array.isArray(treatments) ? treatments : [],
          Array.isArray(vaccines) ? vaccines : []
        )
      );
    });
  }, []);

  function applyCatalogKey(key: string) {
    if (key === CUSTOM_CATALOG_KEY) {
      setForm((prev) => ({
        ...prev,
        catalogKey: CUSTOM_CATALOG_KEY,
        doseKind: "treatment",
        type: "DIPPING",
        product: "",
        dose: "",
        batchNo: "",
        withdrawalPeriod: "",
      }));
      return;
    }
    const entry = catalogByKey.get(key);
    if (!entry) return;
    if (entry.kind === "vaccination") {
      setForm((prev) => ({
        ...prev,
        catalogKey: key,
        doseKind: "vaccination",
        product: entry.name,
        dose: "",
        batchNo: "",
        withdrawalPeriod: "",
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      catalogKey: key,
      doseKind: "treatment",
      type: entry.type && isTreatmentType(entry.type) ? entry.type : "OTHER",
      product: entry.name,
      withdrawalPeriod:
        entry.withdrawalPeriod != null
          ? String(entry.withdrawalPeriod)
          : prev.withdrawalPeriod,
    }));
  }

  function setCustomDoseKind(kind: DoseKind) {
    setForm((prev) => ({
      ...prev,
      catalogKey: CUSTOM_CATALOG_KEY,
      doseKind: kind,
      ...(kind === "vaccination"
        ? { dose: "", withdrawalPeriod: "", type: "OTHER" }
        : {}),
    }));
  }

  function mergeAnimalsLoaded(animals: PickerAnimal[]) {
    setAnimalById((prev) => {
      const next = new Map(prev);
      animals.forEach((a) => next.set(a.id, a));
      return next;
    });
  }

  const extrasSummary = useMemo(() => {
    if (isVaccination) {
      return form.batchNo.trim() || t("noneSet");
    }
    const parts = [
      form.dose.trim() || null,
      form.withdrawalPeriod.trim()
        ? t("withdrawalDaysSuffix", { n: form.withdrawalPeriod })
        : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : t("noneSet");
  }, [form.batchNo, form.dose, form.withdrawalPeriod, isVaccination, t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      alert(t("selectAtLeastOneAnimal"));
      return;
    }
    if (!form.product.trim()) {
      alert(isVaccination ? t("selectVaccineOrName") : t("productRequired"));
      return;
    }

    const parsed = parseCatalogKey(form.catalogKey);
    const confirmKey = isVaccination
      ? "confirmApplyVaccination"
      : "confirmApplyTreatment";
    const confirmLabel = isVaccination
      ? form.product.trim()
      : t(treatmentTypeKey(form.type));

    if (
      !confirm(
        t(confirmKey, {
          type: confirmLabel,
          n: selected.size,
        })
      )
    ) {
      return;
    }

    setSaving(true);
    setResult(null);
    const res = await fetch("/api/health/bulk-treatment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doseKind: form.doseKind,
        animalIds: [...selected],
        treatmentCatalogId:
          parsed?.kind === "treatment" ? parsed.catalogId : null,
        vaccineCatalogId:
          parsed?.kind === "vaccination" ? parsed.catalogId : null,
        type: isVaccination ? undefined : form.type,
        product: isVaccination ? undefined : form.product,
        vaccineName: isVaccination ? form.product : undefined,
        dose: form.dose || null,
        batchNo: form.batchNo || null,
        withdrawalPeriod: isVaccination ? null : form.withdrawalPeriod || null,
        date: form.date || undefined,
        notes: form.notes || null,
        totalCostTzs: form.totalCostTzs || null,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("bulkTreatmentFailed"));
      return;
    }

    const data = await res.json();
    setResult({
      applied: data.applied,
      skipped: data.skipped,
      doseKind: form.doseKind,
    });
    setForm({
      catalogKey: CUSTOM_CATALOG_KEY,
      doseKind: "treatment",
      type: "DIPPING",
      product: "",
      dose: "",
      batchNo: "",
      withdrawalPeriod: "",
      date: "",
      notes: "",
      totalCostTzs: "",
    });
    setExtrasOpen(false);
    setSelected(new Set());
  }

  return (
    <div className="space-y-6 max-w-5xl pb-8">
      <div>
        <Link
          href="/health"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("backToHealth")}
        </Link>
        <h1 className="text-3xl font-bold">{t("bulkTreatmentTitle")}</h1>
        <p className="text-muted-foreground mt-1">{t("bulkTreatmentSubtitle")}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t("useScheduleFrom")}{" "}
          <Link href="/health/schedules" className="text-primary hover:underline">
            {t("healthSchedules")}
          </Link>{" "}
          {t("toSetNextDueAuto")}
        </p>
      </div>

      {result && (
        <SuccessDialog
          open
          title={
            result.doseKind === "vaccination"
              ? t("bulkVaccinationSuccessTitle")
              : t("bulkTreatmentSuccessTitle")
          }
          message={
            <>
              {t("appliedToN", { n: result.applied })}
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
            storageKey="manyika.bulkTreatment.picker.columns"
            statusFilterDefault="ACTIVE"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("treatmentDetails")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("animalsSelectedCount", {
              selected: selected.size,
              total: selected.size,
            })}
          </p>
        </CardHeader>
        <CardContent>
          <SelectedAnimalsList selected={selected} animalById={animalById} />
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 mt-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("fromSchedule")}</Label>
              <Select value={form.catalogKey} onValueChange={applyCatalogKey}>
                <SelectTrigger>
                  <SelectValue placeholder={t("optionalSchedule")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CUSTOM_CATALOG_KEY}>
                    {t("customOneOff")}
                  </SelectItem>
                  {treatmentCatalog.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{t("healthCatalogTreatments")}</SelectLabel>
                      {treatmentCatalog.map((entry) => (
                        <SelectItem key={entry.key} value={entry.key}>
                          {entry.name}
                          {entry.intervalDays
                            ? ` (${t("everyNDays", { n: entry.intervalDays })})`
                            : ""}
                          {entry.type
                            ? ` · ${t(treatmentTypeKey(entry.type))}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {vaccineCatalog.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{t("healthCatalogVaccines")}</SelectLabel>
                      {vaccineCatalog.map((entry) => (
                        <SelectItem key={entry.key} value={entry.key}>
                          {entry.name}
                          {entry.intervalDays
                            ? ` (${t("everyNDays", { n: entry.intervalDays })})`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("scheduleAutoDue")}
              </p>
            </div>

            {!fromCatalog && (
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("bulkDoseKind")}</Label>
                <ChoicePills<DoseKind>
                  value={form.doseKind}
                  onChange={setCustomDoseKind}
                  options={[
                    { value: "treatment", label: t("healthPillTreatments") },
                    { value: "vaccination", label: t("healthPillVaccinations") },
                  ]}
                />
              </div>
            )}

            {!isVaccination && (
              <div className="space-y-2">
                <Label>{t("type")} *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                  disabled={fromCatalog}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {treatmentTypeOptions.map((tt) => (
                      <SelectItem key={tt.value} value={tt.value}>
                        {tt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className={`space-y-2 ${isVaccination ? "sm:col-span-2" : ""}`}>
              <Label>{isVaccination ? t("vaccineName") : t("product")} *</Label>
              <Input
                value={form.product}
                onChange={(e) =>
                  setForm({
                    ...form,
                    product: e.target.value,
                    catalogKey: CUSTOM_CATALOG_KEY,
                  })
                }
                placeholder={
                  isVaccination ? t("vaccineName") : "e.g. Amitraz, Albendazole"
                }
                required
                disabled={fromCatalog}
              />
            </div>

            <div className="sm:col-span-2 rounded-lg border">
              <OptionalSection
                embedded
                open={extrasOpen}
                onToggle={() => setExtrasOpen((o) => !o)}
                title={
                  isVaccination
                    ? t("doseExtrasVaccination")
                    : t("doseExtrasTreatment")
                }
                summary={extrasSummary}
              >
                {isVaccination ? (
                  <div className="space-y-2">
                    <Label>{t("batchNo")}</Label>
                    <Input
                      value={form.batchNo}
                      onChange={(e) =>
                        setForm({ ...form, batchNo: e.target.value })
                      }
                      placeholder={t("batchNo")}
                    />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("dose")}</Label>
                      <Input
                        value={form.dose}
                        onChange={(e) =>
                          setForm({ ...form, dose: e.target.value })
                        }
                        placeholder="e.g. 10 ml / 100 kg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("withdrawalDays")}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.withdrawalPeriod}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            withdrawalPeriod: e.target.value,
                          })
                        }
                        placeholder={t("withdrawalDays")}
                      />
                    </div>
                  </div>
                )}
              </OptionalSection>
            </div>

            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("bulkTreatmentTotalCost")}</Label>
              <Input
                type="number"
                min={0}
                value={form.totalCostTzs}
                onChange={(e) =>
                  setForm({ ...form, totalCostTzs: e.target.value })
                }
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                {t("bulkTreatmentTotalCostHelp")}
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("notes")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Batch, weather, crush notes…"
              />
            </div>
            <Button
              type="submit"
              disabled={saving || selected.size === 0}
              className="sm:col-span-2"
            >
              {saving
                ? t("applying")
                : isVaccination
                  ? t("applyVaccinationToN", { n: selected.size })
                  : t("applyToN", { n: selected.size })}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
