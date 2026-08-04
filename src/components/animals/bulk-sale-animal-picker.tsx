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
import {
  CustomizeColumnsPanel,
  loadColumnPrefs,
  type AnimalColumnId,
} from "@/components/animals/customize-columns";
import { ChoicePills } from "@/components/choice-pills";
import { useLocale, useT } from "@/components/providers/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { parseAnimalsList } from "@/lib/animals-api";
import { lifecycleKind, lifecycleLabelKey } from "@/lib/lifecycle";
import { resolveTagColor } from "@/lib/tag-color";
import { cn } from "@/lib/utils";
import { Columns3, Filter, Search } from "lucide-react";

const SELLABLE_STATUSES = new Set(["ACTIVE", "QUARANTINE", "MISSING"]);

export type BulkSaleAnimal = {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  status: string;
  ageMonths?: number | null;
  dateOfBirth?: string | null;
  dob?: string | null;
  isCastrated?: boolean | null;
  isPregnant?: boolean | null;
  tagColor?: string | null;
  rfidChip?: string | null;
  herdPlan?: "EXCLUDED" | "KEEP_BREEDING" | "SELL_NEXT_CYCLE";
  herdPlanNote?: string | null;
  camp?: { id: string; name: string; tagColor?: string | null };
  owner?: { id: string; name: string } | null;
  sire?: { id: string; eartag: string } | null;
  dam?: { id: string; eartag: string } | null;
};

type CampOption = { id: string; name: string };
type OwnerOption = { id: string; name: string };

type Props = {
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  campIds: string[];
  onCampIdsChange: (ids: string[]) => void;
  camps: CampOption[];
  onlyMarked: boolean;
  onOnlyMarkedChange: (value: boolean) => void;
  /** Increment after a successful sale to reload the list without auto-selecting. */
  reloadToken?: number;
};

function herdPlanLabelKey(
  plan: BulkSaleAnimal["herdPlan"]
): TranslationKey {
  switch (plan) {
    case "KEEP_BREEDING":
      return "herdPlanKeepBreeding";
    case "SELL_NEXT_CYCLE":
      return "herdPlanSellNextCycle";
    default:
      return "herdPlanExcluded";
  }
}

function statusLabelKey(status: string): TranslationKey {
  switch (status) {
    case "ACTIVE":
      return "statusActive";
    case "QUARANTINE":
      return "quarantine";
    case "MISSING":
      return "statusMissing";
    default:
      return "statusActive";
  }
}

function formatDob(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "sw" ? "sw-TZ" : "en-TZ");
}

export function BulkSaleAnimalPicker({
  selected,
  onSelectedChange,
  campIds,
  onCampIdsChange,
  camps,
  onlyMarked,
  onOnlyMarkedChange,
  reloadToken = 0,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const storageKey = "manyika.bulkSale.columns";

  const [breeds, setBreeds] = useState<string[]>([]);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [animals, setAnimals] = useState<BulkSaleAnimal[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sex, setSex] = useState("all");
  const [breed, setBreed] = useState("all");
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState("all");
  const [herdPlan, setHerdPlan] = useState("all");
  const [castrated, setCastrated] = useState("all");
  const [pregnant, setPregnant] = useState("all");
  const [ageGroup, setAgeGroup] = useState("all");
  const [ageMinMonths, setAgeMinMonths] = useState("");
  const [ageMaxMonths, setAgeMaxMonths] = useState("");
  const [dobFrom, setDobFrom] = useState("");
  const [dobTo, setDobTo] = useState("");
  const [tagColor, setTagColor] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<AnimalColumnId[]>(() =>
    loadColumnPrefs(storageKey, "bulkSale")
  );
  const [yearColors, setYearColors] = useState<Record<string, string>>({});
  const [defaultTagColor, setDefaultTagColor] = useState<string | null>(null);

  useEffect(() => {
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
    fetch("/api/owners")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setOwners(Array.isArray(d) ? d : d?.owners || []))
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

  function toggleCamp(id: string) {
    onCampIdsChange(
      campIds.includes(id)
        ? campIds.filter((c) => c !== id)
        : [...campIds, id]
    );
  }

  const allCampsSelected =
    camps.length > 0 && campIds.length === camps.length;

  function toggleAllCamps() {
    if (allCampsSelected) onCampIdsChange([]);
    else onCampIdsChange(camps.map((c) => c.id));
  }

  const canLoad = onlyMarked || campIds.length > 0;

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({
      limit: "5000",
      sort: "eartag_asc",
    });
    if (sex !== "all") params.set("sex", sex);
    if (breed !== "all") params.set("breed", breed);
    if (owner !== "all") params.set("owner", owner);
    if (status !== "all") params.set("status", status);
    if (!onlyMarked && herdPlan !== "all") params.set("herdPlan", herdPlan);
    if (onlyMarked) params.set("herdPlan", "SELL_NEXT_CYCLE");
    if (castrated === "true" || castrated === "false") {
      params.set("castrated", castrated);
    }
    if (pregnant === "true" || pregnant === "false") {
      params.set("pregnant", pregnant);
    }
    if (ageGroup !== "all" && ageGroup !== "months" && ageGroup !== "born") {
      params.set("ageGroup", ageGroup);
    }
    if (ageGroup === "months") {
      if (ageMinMonths.trim()) params.set("ageMinMonths", ageMinMonths.trim());
      if (ageMaxMonths.trim()) params.set("ageMaxMonths", ageMaxMonths.trim());
    }
    if (ageGroup === "born") {
      if (dobFrom) params.set("dobFrom", dobFrom);
      if (dobTo) params.set("dobTo", dobTo);
    }
    if (search.trim()) params.set("search", search.trim());
    if (tagColor) params.set("tagColor", tagColor);
    return params;
  }, [
    sex,
    breed,
    owner,
    status,
    herdPlan,
    onlyMarked,
    castrated,
    pregnant,
    ageGroup,
    ageMinMonths,
    ageMaxMonths,
    dobFrom,
    dobTo,
    search,
    tagColor,
  ]);

  const load = useCallback(
    async (autoSelectMarked: boolean) => {
      if (!canLoad) {
        setAnimals([]);
        return;
      }
      setLoading(true);
      const baseParams = buildParams();
      let list: BulkSaleAnimal[] = [];

      if (
        (onlyMarked && campIds.length === 0) ||
        (campIds.length === camps.length && camps.length > 0)
      ) {
        const res = await fetch(`/api/animals?${baseParams}`);
        const data = res.ok ? await res.json() : null;
        list = parseAnimalsList<BulkSaleAnimal>(data);
      } else if (campIds.length > 0) {
        const results = await Promise.all(
          campIds.map(async (campId) => {
            const campParams = new URLSearchParams(baseParams);
            campParams.set("camp", campId);
            const res = await fetch(`/api/animals?${campParams}`);
            const data = res.ok ? await res.json() : null;
            return parseAnimalsList<BulkSaleAnimal>(data);
          })
        );
        const byId = new Map<string, BulkSaleAnimal>();
        for (const rows of results) {
          for (const row of rows) {
            if (!byId.has(row.id)) byId.set(row.id, row);
          }
        }
        list = [...byId.values()];
      }

      list = list.filter((a) => SELLABLE_STATUSES.has(a.status));

      if (tagColor) {
        list = list.filter((a) => {
          const resolved = resolveTagColor({
            animalTagColor: a.tagColor,
            campTagColor: a.camp?.tagColor,
            defaultTagColor,
            dob: a.dateOfBirth ?? a.dob,
            ageMonths: a.ageMonths,
            yearColors,
          }).color;
          return resolved === tagColor;
        });
      }

      list.sort((a, b) =>
        a.eartag.localeCompare(b.eartag, undefined, { numeric: true })
      );
      setAnimals(list);
      if (autoSelectMarked && onlyMarked) {
        onSelectedChange(new Set(list.map((a) => a.id)));
      }
      setLoading(false);
    },
    [
      canLoad,
      buildParams,
      onlyMarked,
      campIds,
      camps.length,
      tagColor,
      defaultTagColor,
      yearColors,
      onSelectedChange,
    ]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!canLoad) {
        setAnimals([]);
        onSelectedChange(new Set());
        return;
      }
      load(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [canLoad, load]);

  useEffect(() => {
    if (reloadToken > 0) load(false);
  }, [reloadToken, load]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (sex !== "all") n += 1;
    if (breed !== "all") n += 1;
    if (owner !== "all") n += 1;
    if (status !== "all") n += 1;
    if (!onlyMarked && herdPlan !== "all") n += 1;
    if (castrated !== "all") n += 1;
    if (pregnant !== "all") n += 1;
    if (ageGroup !== "all") n += 1;
    if (tagColor) n += 1;
    return n;
  }, [
    sex,
    breed,
    owner,
    status,
    herdPlan,
    onlyMarked,
    castrated,
    pregnant,
    ageGroup,
    tagColor,
  ]);

  const allSelected =
    animals.length > 0 && animals.every((a) => selected.has(a.id));
  const someSelected =
    animals.some((a) => selected.has(a.id)) && !allSelected;

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

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  }

  function clearFilters() {
    setSex("all");
    setBreed("all");
    setOwner("all");
    setStatus("all");
    setHerdPlan("all");
    setCastrated("all");
    setPregnant("all");
    setAgeGroup("all");
    setAgeMinMonths("");
    setAgeMaxMonths("");
    setDobFrom("");
    setDobTo("");
    setTagColor(null);
  }

  const colVisible = (id: AnimalColumnId) => columns.includes(id);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={onlyMarked}
          onChange={(e) => onOnlyMarkedChange(e.target.checked)}
        />
        {t("onlyMarkedForSale")}
      </label>

      <div className="space-y-2">
        <Label>
          {t("camp")}
          {!onlyMarked ? " *" : ""}
        </Label>
        <p className="text-xs text-muted-foreground">
          {onlyMarked ? t("optionalCampsOrAll") : t("selectCampsOrAll")}
          {campIds.length > 0 && (
            <>
              {" "}
              ·{" "}
              {allCampsSelected
                ? t("allCamps")
                : t("campsSelectedCount", { n: campIds.length })}
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleAllCamps}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              allCampsSelected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-border"
            }`}
          >
            {t("allCamps")}
          </button>
          {camps.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCamp(c.id)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                campIds.includes(c.id)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {!canLoad ? (
        <p className="text-sm text-muted-foreground">{t("selectCampLoad")}</p>
      ) : (
        <>
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
              <div className="space-y-2">
                <Label>{t("eartagColor")}</Label>
                <TagColorFilter value={tagColor} onChange={setTagColor} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
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
                <div className="space-y-2">
                  <Label>{t("status")}</Label>
                  <ChoicePills
                    options={[
                      { value: "all", label: t("statusAllSellable") },
                      { value: "ACTIVE", label: t("statusActive") },
                      { value: "QUARANTINE", label: t("quarantine") },
                      { value: "MISSING", label: t("statusMissing") },
                    ]}
                    value={status}
                    onChange={setStatus}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("breed")}</Label>
                  <Select value={breed} onValueChange={setBreed}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allBreeds")}</SelectItem>
                      {breeds.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("owner")}</Label>
                  <Select value={owner} onValueChange={setOwner}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allOwners")}</SelectItem>
                      {owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!onlyMarked && (
                <div className="space-y-2">
                  <Label>{t("herdPlan")}</Label>
                  <ChoicePills
                    options={[
                      { value: "all", label: t("all") },
                      {
                        value: "SELL_NEXT_CYCLE",
                        label: t("herdPlanSellNextCycle"),
                      },
                      {
                        value: "KEEP_BREEDING",
                        label: t("herdPlanKeepBreeding"),
                      },
                      { value: "EXCLUDED", label: t("herdPlanExcluded") },
                    ]}
                    value={herdPlan}
                    onChange={setHerdPlan}
                  />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("castrated")}</Label>
                  <ChoicePills
                    options={[
                      { value: "all", label: t("all") },
                      { value: "true", label: t("yes") },
                      { value: "false", label: t("no") },
                    ]}
                    value={castrated}
                    onChange={setCastrated}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("pregnant")}</Label>
                  <ChoicePills
                    options={[
                      { value: "all", label: t("all") },
                      { value: "true", label: t("yes") },
                      { value: "false", label: t("no") },
                    ]}
                    value={pregnant}
                    onChange={setPregnant}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("age")}</Label>
                <ChoicePills
                  options={[
                    { value: "all", label: t("allAges") },
                    { value: "calf", label: t("calves") },
                    { value: "yearling", label: t("weaners") },
                    { value: "adult", label: t("adults") },
                    { value: "mature", label: t("ageMature") },
                    { value: "months", label: t("ageModeMonths") },
                    { value: "born", label: t("ageModeBorn") },
                  ]}
                  value={ageGroup}
                  onChange={setAgeGroup}
                />
                {ageGroup === "months" && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <Input
                      type="number"
                      min={0}
                      placeholder={t("ageMinMonths")}
                      value={ageMinMonths}
                      onChange={(e) => setAgeMinMonths(e.target.value)}
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder={t("ageMaxMonths")}
                      value={ageMaxMonths}
                      onChange={(e) => setAgeMaxMonths(e.target.value)}
                    />
                  </div>
                )}
                {ageGroup === "born" && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <Input
                      type="date"
                      value={dobFrom}
                      onChange={(e) => setDobFrom(e.target.value)}
                    />
                    <Input
                      type="date"
                      value={dobTo}
                      onChange={(e) => setDobTo(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                >
                  {t("clearAll")}
                </button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setFiltersOpen(false)}
                >
                  {t("apply")}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loadingAnimals")}</p>
          ) : animals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {onlyMarked ? t("noMarkedForSale") : t("noActiveAnimalsInCamps")}
            </p>
          ) : (
            <div className="rounded-lg border overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur">
                  <tr className="border-b text-left">
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
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("eartag")}
                      </th>
                    )}
                    {colVisible("breed") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("breed")}
                      </th>
                    )}
                    {colVisible("sex") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("sex")}
                      </th>
                    )}
                    {colVisible("type") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("lifecycleType")}
                      </th>
                    )}
                    {colVisible("status") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("status")}
                      </th>
                    )}
                    {colVisible("camp") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("camp")}
                      </th>
                    )}
                    {colVisible("age") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("age")}
                      </th>
                    )}
                    {colVisible("rfid") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("rfidChip")}
                      </th>
                    )}
                    {colVisible("herdPlan") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("herdPlan")}
                      </th>
                    )}
                    {colVisible("owner") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("owner")}
                      </th>
                    )}
                    {colVisible("dob") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("dob")}
                      </th>
                    )}
                    {colVisible("castrated") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("castrated")}
                      </th>
                    )}
                    {colVisible("pregnant") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("pregnant")}
                      </th>
                    )}
                    {colVisible("sire") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("sire")}
                      </th>
                    )}
                    {colVisible("dam") && (
                      <th className="p-2 font-medium whitespace-nowrap">
                        {t("dam")}
                      </th>
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
                    const dobValue = a.dateOfBirth ?? a.dob;
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
                          <td className="p-2 whitespace-nowrap">
                            <EartagBadge
                              eartag={a.eartag}
                              animalTagColor={a.tagColor}
                              campTagColor={a.camp?.tagColor}
                              defaultTagColor={defaultTagColor}
                              dob={dobValue}
                              ageMonths={a.ageMonths}
                              yearColors={yearColors}
                              locale={locale}
                            />
                          </td>
                        )}
                        {colVisible("breed") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {a.breed}
                          </td>
                        )}
                        {colVisible("sex") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {a.sex === "MALE"
                              ? t("male")
                              : a.sex === "FEMALE"
                                ? t("female")
                                : t("unknownSex")}
                          </td>
                        )}
                        {colVisible("type") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {t(lifecycleLabelKey(life))}
                          </td>
                        )}
                        {colVisible("status") && (
                          <td className="p-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  a.status === "ACTIVE"
                                    ? "bg-emerald-500"
                                    : "bg-muted-foreground"
                                )}
                              />
                              {t(statusLabelKey(a.status))}
                            </span>
                          </td>
                        )}
                        {colVisible("camp") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {a.camp?.name || "—"}
                          </td>
                        )}
                        {colVisible("age") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {a.ageMonths != null ? `${a.ageMonths} mo` : "—"}
                          </td>
                        )}
                        {colVisible("rfid") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap font-mono text-xs">
                            {a.rfidChip || "—"}
                          </td>
                        )}
                        {colVisible("herdPlan") && (
                          <td className="p-2 whitespace-nowrap">
                            {a.herdPlan === "SELL_NEXT_CYCLE" ? (
                              <Badge variant="warning">
                                {t(herdPlanLabelKey(a.herdPlan))}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">
                                {t(herdPlanLabelKey(a.herdPlan))}
                              </span>
                            )}
                          </td>
                        )}
                        {colVisible("owner") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {a.owner?.name || "—"}
                          </td>
                        )}
                        {colVisible("dob") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {formatDob(dobValue, locale)}
                          </td>
                        )}
                        {colVisible("castrated") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {a.sex === "MALE"
                              ? a.isCastrated
                                ? t("yes")
                                : t("no")
                              : "—"}
                          </td>
                        )}
                        {colVisible("pregnant") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {a.sex === "FEMALE"
                              ? a.isPregnant
                                ? t("yes")
                                : t("no")
                              : "—"}
                          </td>
                        )}
                        {colVisible("sire") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {a.sire?.eartag || "—"}
                          </td>
                        )}
                        {colVisible("dam") && (
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {a.dam?.eartag || "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary">
              {t("selectedOf", {
                selected: selected.size,
                total: animals.length,
              })}
            </Badge>
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
              onClick={() => onSelectedChange(new Set())}
            >
              {t("deselectAll")}
            </button>
          </div>
        </>
      )}

      <CustomizeColumnsPanel
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        storageKey={storageKey}
        value={columns}
        onChange={setColumns}
        variant="bulkSale"
      />
    </div>
  );
}
