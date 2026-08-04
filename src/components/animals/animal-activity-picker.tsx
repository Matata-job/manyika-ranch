"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { EartagBadge } from "@/components/eartag-badge";
import { TagColorFilter } from "@/components/animals/tag-color-filter";
import { MultiTogglePills } from "@/components/animals/multi-toggle-pills";
import {
  CustomizeColumnsPanel,
  loadColumnPrefs,
  type AnimalColumnId,
} from "@/components/animals/customize-columns";
import { HerdPlanFilter } from "@/components/animals/herd-plan-filter";
import { ChoicePills } from "@/components/choice-pills";
import { useLocale, useT } from "@/components/providers/locale-provider";
import { parseAnimalsList } from "@/lib/animals-api";
import { joinMultiParam } from "@/lib/multi-filter";
import { lifecycleKind, lifecycleLabelKey } from "@/lib/lifecycle";
import { herdPlanBadgeVariant, herdPlanLabelKey } from "@/lib/herd-plan";
import { resolveTagColor } from "@/lib/tag-color";
import { cn } from "@/lib/utils";
import { Columns3, Filter, Search } from "lucide-react";

export type PickerAnimal = {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  status: string;
  ageMonths?: number | null;
  dateOfBirth?: string | null;
  isCastrated?: boolean | null;
  tagColor?: string | null;
  herdPlan?: "EXCLUDED" | "KEEP_BREEDING" | "SELL_NEXT_CYCLE" | "KULIMA";
  herdPlanNote?: string | null;
  camp: { id: string; name: string; tagColor?: string | null };
};

type CampOption = { id: string; name: string };

type Props = {
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  storageKey?: string;
  /** Exclude deceased/sold by default */
  statusFilterDefault?: string;
  onContinue?: () => void;
  continueLabel?: string;
};

export function AnimalActivityPicker({
  selected,
  onSelectedChange,
  storageKey = "manyika.animalPicker.columns",
  statusFilterDefault = "ACTIVE",
  onContinue,
  continueLabel,
}: Props) {
  const t = useT();
  const locale = useLocale().locale;
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [breeds, setBreeds] = useState<string[]>([]);
  const [animals, setAnimals] = useState<PickerAnimal[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [camp, setCamp] = useState("all");
  const [sex, setSex] = useState("all");
  const [breedsSelected, setBreedsSelected] = useState<string[]>([]);
  const [status, setStatus] = useState(statusFilterDefault);
  const [tagColors, setTagColors] = useState<string[]>([]);
  const [herdPlan, setHerdPlan] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<AnimalColumnId[]>(() =>
    loadColumnPrefs(storageKey)
  );
  const [yearColors, setYearColors] = useState<Record<string, string>>({});
  const [defaultTagColor, setDefaultTagColor] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : d.camps || []));
    fetch("/api/breeds")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = Array.isArray(d) ? d : d?.breeds || [];
        setBreeds(
          list
            .map((b: { name?: string } | string) =>
              typeof b === "string" ? b : b.name
            )
            .filter(Boolean)
        );
      })
      .catch(() => {});
    fetch("/api/ranch/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setYearColors(d.eartagYearColors || {});
        setDefaultTagColor(d.defaultTagColor || null);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "5000", sort: "eartag_asc" });
    if (camp !== "all") params.set("camp", camp);
    if (sex !== "all") params.set("sex", sex);
    const breedParam = joinMultiParam(breedsSelected);
    if (breedParam) params.set("breed", breedParam);
    if (status && status !== "ALL") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    const tagParam = joinMultiParam(tagColors);
    if (tagParam) params.set("tagColor", tagParam);
    if (herdPlan !== "all") params.set("herdPlan", herdPlan);
    const res = await fetch(`/api/animals?${params}`);
    const data = res.ok ? await res.json() : null;
    let list = parseAnimalsList<PickerAnimal>(data);
    if (statusFilterDefault === "ACTIVE") {
      list = list.filter((a) => a.status !== "DECEASED" && a.status !== "SOLD");
    }
    // Client refine by resolved colour (includes year map)
    if (tagColors.length > 0) {
      const allowed = new Set(tagColors);
      list = list.filter((a) => {
        const resolved = resolveTagColor({
          animalTagColor: a.tagColor,
          campTagColor: a.camp?.tagColor,
          defaultTagColor,
          dob: a.dateOfBirth,
          ageMonths: a.ageMonths,
          yearColors,
        }).color;
        return resolved != null && allowed.has(resolved);
      });
    }
    setAnimals(list);
    setLoading(false);
  }, [
    camp,
    sex,
    breedsSelected,
    status,
    search,
    tagColors,
    herdPlan,
    statusFilterDefault,
    defaultTagColor,
    yearColors,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 200);
    return () => clearTimeout(timer);
  }, [load]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (camp !== "all") n += 1;
    if (sex !== "all") n += 1;
    if (breedsSelected.length > 0) n += 1;
    if (status !== statusFilterDefault) n += 1;
    if (tagColors.length > 0) n += 1;
    if (herdPlan !== "all") n += 1;
    return n;
  }, [camp, sex, breedsSelected, status, tagColors, herdPlan, statusFilterDefault]);

  const allSelected = animals.length > 0 && animals.every((a) => selected.has(a.id));
  const someSelected = animals.some((a) => selected.has(a.id)) && !allSelected;

  function toggleAllPage() {
    if (allSelected) {
      const next = new Set(selected);
      animals.forEach((a) => next.delete(a.id));
      onSelectedChange(next);
    } else {
      const next = new Set(selected);
      animals.forEach((a) => next.add(a.id));
      onSelectedChange(next);
    }
  }

  function deselectAll() {
    onSelectedChange(new Set());
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  }

  function clearFilters() {
    setCamp("all");
    setSex("all");
    setBreedsSelected([]);
    setStatus(statusFilterDefault);
    setTagColors([]);
    setHerdPlan("all");
  }

  const colVisible = (id: AnimalColumnId) => columns.includes(id);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t("searchAnimalsByEartag")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={camp} onValueChange={setCamp}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t("camp")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCamps")}</SelectItem>
              {camps.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setColumnsOpen(true)}
          >
            <Columns3 className="h-4 w-4 mr-1.5" />
            {t("columnsCount", { n: columns.length })}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(filtersOpen && "border-foreground/40 bg-muted/40")}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            {t("filters")}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {filtersOpen && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
          <p className="text-xs text-muted-foreground">{t("filterMultiHint")}</p>
          <div className="space-y-2">
            <Label>{t("eartagColor")}</Label>
            <TagColorFilter
              value={tagColors}
              onChange={setTagColors}
              showHelp={false}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("breed")}</Label>
            <MultiTogglePills
              options={breeds.map((b) => ({ value: b, label: b }))}
              value={breedsSelected}
              onChange={setBreedsSelected}
              allLabel={t("allBreeds")}
            />
          </div>
          <HerdPlanFilter value={herdPlan} onChange={setHerdPlan} />
          <div className="space-y-2">
            <Label>{t("status")}</Label>
            <ChoicePills
              options={[
                { value: "ACTIVE", label: t("statusActive") },
                { value: "DECEASED", label: t("statusDeceased") },
                { value: "SOLD", label: t("statusSold") },
                { value: "ALL", label: t("all") },
              ]}
              value={status}
              onChange={setStatus}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("sex")}</Label>
            <ChoicePills
              options={[
                { value: "all", label: t("all") },
                { value: "MALE", label: t("male") },
                { value: "FEMALE", label: t("female") },
              ]}
              value={sex}
              onChange={setSex}
            />
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={clearFilters}
            >
              {t("clearAll")}
            </button>
            <Button type="button" size="sm" onClick={() => setFiltersOpen(false)}>
              {t("apply")}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loadingAnimals")}</p>
      ) : animals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noAnimalsMatch")}</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAllPage}
                    aria-label={t("selectAll")}
                  />
                </th>
                {colVisible("eartag") && (
                  <th className="p-2 font-medium">{t("eartag")}</th>
                )}
                {colVisible("breed") && (
                  <th className="p-2 font-medium">{t("breed")}</th>
                )}
                {colVisible("sex") && (
                  <th className="p-2 font-medium">{t("sex")}</th>
                )}
                {colVisible("type") && (
                  <th className="p-2 font-medium">{t("lifecycleType")}</th>
                )}
                {colVisible("status") && (
                  <th className="p-2 font-medium">{t("status")}</th>
                )}
                {colVisible("camp") && (
                  <th className="p-2 font-medium">{t("camp")}</th>
                )}
                {colVisible("age") && (
                  <th className="p-2 font-medium">{t("age")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {animals.map((a) => {
                const life = lifecycleKind({
                  sex: a.sex,
                  ageMonths: a.ageMonths,
                  isCastrated: a.isCastrated,
                });
                const checked = selected.has(a.id);
                return (
                  <tr
                    key={a.id}
                    className={cn(
                      "border-b last:border-0 hover:bg-muted/30",
                      checked && "bg-primary/5"
                    )}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(a.id)}
                      />
                    </td>
                    {colVisible("eartag") && (
                      <td className="p-2">
                        <EartagBadge
                          eartag={a.eartag}
                          animalTagColor={a.tagColor}
                          campTagColor={a.camp?.tagColor}
                          defaultTagColor={defaultTagColor}
                          dob={a.dateOfBirth}
                          ageMonths={a.ageMonths}
                          yearColors={yearColors}
                          locale={locale}
                        />
                      </td>
                    )}
                    {colVisible("breed") && (
                      <td className="p-2 text-muted-foreground">{a.breed}</td>
                    )}
                    {colVisible("sex") && (
                      <td className="p-2 text-muted-foreground">
                        {a.sex === "MALE"
                          ? t("male")
                          : a.sex === "FEMALE"
                            ? t("female")
                            : t("unknownSex")}
                      </td>
                    )}
                    {colVisible("type") && (
                      <td className="p-2 text-muted-foreground">
                        {t(lifecycleLabelKey(life))}
                      </td>
                    )}
                    {colVisible("status") && (
                      <td className="p-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              a.status === "ACTIVE"
                                ? "bg-emerald-500"
                                : "bg-muted-foreground"
                            )}
                          />
                          {a.status === "ACTIVE"
                            ? t("statusActive")
                            : a.status === "DECEASED"
                              ? t("statusDeceased")
                              : a.status === "SOLD"
                                ? t("statusSold")
                                : a.status}
                        </span>
                      </td>
                    )}
                    {colVisible("camp") && (
                      <td className="p-2 text-muted-foreground">
                        {a.camp?.name || "—"}
                      </td>
                    )}
                    {colVisible("age") && (
                      <td className="p-2 text-muted-foreground">
                        {a.ageMonths != null ? `${a.ageMonths} mo` : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-background/95 backdrop-blur px-3 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">
            {t("animalsSelectedCount", {
              selected: selected.size,
              total: animals.length,
            })}
          </span>
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={toggleAllPage}
          >
            {t("selectAllOnPage")}
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={deselectAll}
          >
            {t("deselectAll")}
          </button>
        </div>
        {onContinue && (
          <Button
            type="button"
            disabled={selected.size === 0}
            onClick={onContinue}
          >
            {continueLabel || t("continueToActivity")}
          </Button>
        )}
      </div>

      <CustomizeColumnsPanel
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        storageKey={storageKey}
        value={columns}
        onChange={setColumns}
      />
    </div>
  );
}
