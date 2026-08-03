"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid, List, Plus, Search, SlidersHorizontal, StickyNote, X, ArrowUpDown } from "lucide-react";

import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { cn, formatAge, type AgeDisplayMode } from "@/lib/utils";
import { parseAnimalsPage } from "@/lib/animals-api";
import { EartagBadge } from "@/components/eartag-badge";
import { TagColorFilter } from "@/components/animals/tag-color-filter";
import { useLocale, useT } from "@/components/providers/locale-provider";
import { Label } from "@/components/ui/label";
import {
  lifecycleKind,
  lifecycleLabelKey,
} from "@/lib/lifecycle";
import {
  animalStatusBadgeVariant,
  animalStatusLabelKey,
} from "@/lib/animal-status";
import {
  DEFAULT_PAGE_SIZE,
  ListPagination,
} from "@/components/list-pagination";
import { ChoicePills } from "@/components/choice-pills";

interface Animal {
  id: string;
  eartag: string;
  rfidChip?: string | null;
  breed: string;
  sex: string;
  isCastrated?: boolean;
  isPregnant?: boolean;
  ageMonths: number | null;
  dob?: string | null;
  status: string;
  photoUrl: string | null;
  notes?: string | null;
  hasNotes?: boolean;
  tagColor?: string | null;
  camp: { id: string; name: string; tagColor?: string | null };
  owner: { id: string; name: string };
}

type Filters = {
  search: string;
  sex: string;
  breed: string;
  camp: string;
  ageGroup: string;
  ageMinMonths: string;
  ageMaxMonths: string;
  dobFrom: string;
  dobTo: string;
  status: string;
  owner: string;
  castrated: string;
  pregnant: string;
  tagColor: string;
  sort: string;
};

type ViewMode = "list" | "grid";

const VIEW_STORAGE_KEY = "manyika.animals.view";

const DEFAULTS: Filters = {
  search: "",
  sex: "all",
  breed: "all",
  camp: "all",
  ageGroup: "all",
  ageMinMonths: "",
  ageMaxMonths: "",
  dobFrom: "",
  dobTo: "",
  status: "ACTIVE",
  owner: "all",
  castrated: "all",
  pregnant: "all",
  tagColor: "all",
  sort: "eartag_asc",
};

type AgeMode =
  | "all"
  | "calf"
  | "yearling"
  | "adult"
  | "mature"
  | "months"
  | "born";

const ADVANCED_KEYS: (keyof Filters)[] = [
  "sex",
  "breed",
  "camp",
  "status",
  "owner",
  "castrated",
  "pregnant",
  "tagColor",
];

function deriveAgeMode(f: Filters): AgeMode {
  if (f.dobFrom || f.dobTo) return "born";
  if (f.ageMinMonths || f.ageMaxMonths) return "months";
  if (
    f.ageGroup === "calf" ||
    f.ageGroup === "yearling" ||
    f.ageGroup === "adult" ||
    f.ageGroup === "mature"
  ) {
    return f.ageGroup;
  }
  return "all";
}

function ageFilterActive(f: Filters): boolean {
  return (
    f.ageGroup !== "all" ||
    !!f.ageMinMonths ||
    !!f.ageMaxMonths ||
    !!f.dobFrom ||
    !!f.dobTo
  );
}

function filtersFromParams(params: URLSearchParams): Filters {
  return {
    search: params.get("search") || "",
    sex: params.get("sex") || "all",
    breed: params.get("breed") || "all",
    camp: params.get("camp") || "all",
    ageGroup: params.get("ageGroup") || "all",
    ageMinMonths: params.get("ageMinMonths") || "",
    ageMaxMonths: params.get("ageMaxMonths") || "",
    dobFrom: params.get("dobFrom") || "",
    dobTo: params.get("dobTo") || "",
    status: params.get("status") || "ACTIVE",
    owner: params.get("owner") || "all",
    castrated: params.get("castrated") || "all",
    pregnant: params.get("pregnant") || "all",
    tagColor: params.get("tagColor") || "all",
    sort: params.get("sort") || "eartag_asc",
  };
}

function sexShort(sex: string) {
  if (sex === "MALE") return "M";
  if (sex === "FEMALE") return "F";
  return "?";
}

function AnimalStatusBadges({
  animal,
  t,
}: {
  animal: Animal;
  t: ReturnType<typeof useT>;
}) {
  const life = lifecycleKind({
    sex: animal.sex,
    ageMonths: animal.ageMonths,
    isCastrated: animal.isCastrated,
  });
  return (
    <>
      <Badge variant="outline" className="font-normal text-[10px] px-1.5 py-0 h-5">
        {t(lifecycleLabelKey(life))}
      </Badge>
      {animal.sex === "MALE" && animal.isCastrated && (
        <Badge variant="outline" className="font-normal text-[10px] px-1.5 py-0 h-5">
          {t("castrated")}
        </Badge>
      )}
      {animal.sex === "FEMALE" && animal.isPregnant && (
        <Badge variant="warning" className="font-normal text-[10px] px-1.5 py-0 h-5">
          {t("pregnant")}
        </Badge>
      )}
      {animal.status !== "ACTIVE" && (
        <Badge
          variant={animalStatusBadgeVariant(animal.status)}
          className="font-normal text-[10px] px-1.5 py-0 h-5"
        >
          {t(animalStatusLabelKey(animal.status))}
        </Badge>
      )}
    </>
  );
}

function AnimalsPageContent() {
  const t = useT();
  const { locale } = useLocale();
  const { data: session } = useSession();
  const role = session?.user?.role as Role;
  const canCreate = role && hasPermission(role, "createAnimal");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [breeds, setBreeds] = useState<{ id: string; name: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [ageMode, setAgeMode] = useState<AgeDisplayMode>("AUTO");
  const [yearColors, setYearColors] = useState<Record<string, string>>({});
  const [defaultTagColor, setDefaultTagColor] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(searchParams));
  const [ageFilterMode, setAgeFilterMode] = useState<AgeMode>(() =>
    deriveAgeMode(filtersFromParams(searchParams))
  );
  const [searchInput, setSearchInput] = useState(filters.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "list" || stored === "grid") setViewMode(stored);
    } catch {
      /* ignore */
    }
  }, []);

  function setView(mode: ViewMode) {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const next = filtersFromParams(searchParams);
    setFilters(next);
    setSearchInput(searchParams.get("search") || "");
    setAgeFilterMode(deriveAgeMode(next));
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      fetch("/api/camps").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/breeds").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/owners").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/ranch/settings").then((r) => (r.ok ? r.json() : null)),
    ]).then(([c, b, o, settings]) => {
      setCamps(Array.isArray(c) ? c : []);
      setBreeds(Array.isArray(b) ? b : []);
      setOwners(Array.isArray(o) ? o : []);
      if (settings?.ageDisplayMode) setAgeMode(settings.ageDisplayMode);
      if (settings?.eartagYearColors) setYearColors(settings.eartagYearColors);
      if (settings?.defaultTagColor) setDefaultTagColor(settings.defaultTagColor);
      else setDefaultTagColor(null);
    });
  }, []);

  const syncUrl = useCallback(
    (next: Filters) => {
      const params = new URLSearchParams();
      (Object.keys(DEFAULTS) as (keyof Filters)[]).forEach((key) => {
        const value = next[key];
        const def = DEFAULTS[key];
        if (value && value !== def) params.set(key, value);
      });
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    const next = { ...filters, [key]: value };
    if (key === "castrated" && value !== "all") {
      next.sex = "MALE";
      next.pregnant = "all";
    }
    if (key === "pregnant" && value !== "all") {
      next.sex = "FEMALE";
      next.castrated = "all";
    }
    if (key === "sex") {
      if (value !== "MALE") next.castrated = "all";
      if (value !== "FEMALE") next.pregnant = "all";
    }
    if (
      key === "ageMinMonths" ||
      key === "ageMaxMonths"
    ) {
      next.ageGroup = "all";
      next.dobFrom = "";
      next.dobTo = "";
      setAgeFilterMode("months");
    }
    if (key === "dobFrom" || key === "dobTo") {
      next.ageGroup = "all";
      next.ageMinMonths = "";
      next.ageMaxMonths = "";
      setAgeFilterMode("born");
    }
    setFilters(next);
    syncUrl(next);
  }

  function applyAgeFilterMode(mode: AgeMode) {
    const next: Filters = {
      ...filters,
      ageGroup: "all",
      ageMinMonths: "",
      ageMaxMonths: "",
      dobFrom: "",
      dobTo: "",
    };
    if (
      mode === "calf" ||
      mode === "yearling" ||
      mode === "adult" ||
      mode === "mature"
    ) {
      next.ageGroup = mode;
    }
    // months / born / all: leave custom fields empty until user fills them
    setAgeFilterMode(mode);
    setFilters(next);
    syncUrl(next);
  }

  function applyPreset(preset: string) {
    let next: Filters = { ...DEFAULTS };
    if (preset === "castrated") {
      next = { ...DEFAULTS, sex: "MALE", castrated: "true" };
      setFiltersOpen(true);
    } else if (preset === "intact") {
      next = { ...DEFAULTS, sex: "MALE", castrated: "false" };
      setFiltersOpen(true);
    } else if (preset === "pregnant") {
      next = { ...DEFAULTS, sex: "FEMALE", pregnant: "true" };
      setFiltersOpen(true);
    } else if (preset === "calves") {
      next = { ...DEFAULTS, ageGroup: "calf" };
      setFiltersOpen(true);
    } else {
      setFiltersOpen(false);
    }
    setAgeFilterMode(deriveAgeMode(next));
    setFilters(next);
    setSearchInput("");
    syncUrl(next);
  }

  function clearAll() {
    setFilters(DEFAULTS);
    setAgeFilterMode("all");
    setSearchInput("");
    setFiltersOpen(false);
    syncUrl(DEFAULTS);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput === filters.search) return;
      const next = { ...filters, search: searchInput };
      setFilters(next);
      syncUrl(next);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const PAGE_SIZE = DEFAULT_PAGE_SIZE;

  function buildAnimalsParams(pageOffset: number) {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.camp !== "all") params.set("camp", filters.camp);
    if (filters.sex !== "all") params.set("sex", filters.sex);
    if (filters.breed !== "all") params.set("breed", filters.breed);
    if (filters.ageGroup !== "all") params.set("ageGroup", filters.ageGroup);
    if (filters.ageMinMonths) params.set("ageMinMonths", filters.ageMinMonths);
    if (filters.ageMaxMonths) params.set("ageMaxMonths", filters.ageMaxMonths);
    if (filters.dobFrom) params.set("dobFrom", filters.dobFrom);
    if (filters.dobTo) params.set("dobTo", filters.dobTo);
    if (filters.status) params.set("status", filters.status);
    if (filters.owner !== "all") params.set("owner", filters.owner);
    if (filters.castrated !== "all") params.set("castrated", filters.castrated);
    if (filters.pregnant !== "all") params.set("pregnant", filters.pregnant);
    if (filters.tagColor !== "all") params.set("tagColor", filters.tagColor);
    if (filters.sort) params.set("sort", filters.sort);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(pageOffset));
    return params;
  }

  const loadPage = useCallback(
    async (pageOffset: number, opts?: { soft?: boolean }) => {
      if (opts?.soft) setLoadingPage(true);
      else setLoading(true);
      try {
        const res = await fetch(`/api/animals?${buildAnimalsParams(pageOffset)}`);
        const data = res.ok ? await res.json() : null;
        const page = parseAnimalsPage<Animal>(data);
        setAnimals(page.animals);
        setTotal(page.total);
        setOffset(pageOffset);
      } finally {
        setLoading(false);
        setLoadingPage(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters]
  );

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  const advancedCount = useMemo(() => {
    const other = ADVANCED_KEYS.filter((k) => filters[k] !== DEFAULTS[k]).length;
    return other + (ageFilterActive(filters) ? 1 : 0);
  }, [filters]);

  const hasActiveFilters = useMemo(() => {
    return (Object.keys(DEFAULTS) as (keyof Filters)[]).some(
      (k) => filters[k] !== DEFAULTS[k]
    );
  }, [filters]);

  const activePreset =
    filters.castrated === "true" && filters.sex === "MALE"
      ? "castrated"
      : filters.castrated === "false" && filters.sex === "MALE"
        ? "intact"
        : filters.pregnant === "true" && filters.sex === "FEMALE"
          ? "pregnant"
          : filters.ageGroup === "calf" &&
              filters.sex === "all" &&
              filters.castrated === "all" &&
              filters.pregnant === "all"
            ? "calves"
            : !hasActiveFilters
              ? "all"
              : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">
            {t("animalsTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("animalsListHelp")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? t("loading")
              : total > 0
                ? t("showingRangeOf", {
                    from: offset + 1,
                    to: Math.min(offset + animals.length, total),
                    total,
                  })
                : t("showingOfAnimals", {
                    shown: 0,
                    total: 0,
                  })}
            {hasActiveFilters && !loading ? ` · ${t("filtered")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex h-9 items-center rounded-lg border border-muted-foreground/20 p-0.5 bg-muted/30"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors",
                viewMode === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={viewMode === "list"}
            >
              <List className="h-3.5 w-3.5" />
              {t("viewList")}
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors",
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {t("viewGrid")}
            </button>
          </div>
          {canCreate && (
            <Link href="/animals/new">
              <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90">
                <Plus className="h-4 w-4 mr-1.5" />
                {t("addAnimal")}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder={t("searchEartagBreed")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-11 rounded-xl border-border/80 bg-card shadow-sm"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <Select value={filters.sort} onValueChange={(v) => updateFilter("sort", v)}>
              <SelectTrigger className="h-11 w-full sm:w-[168px] rounded-xl border-border/80 bg-card shadow-sm">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder={t("sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eartag_asc">{t("sortEartagAsc")}</SelectItem>
                <SelectItem value="newest">{t("sortNewest")}</SelectItem>
                <SelectItem value="eartag_desc">{t("sortEartagDesc")}</SelectItem>
                <SelectItem value="age_asc">{t("sortAgeAsc")}</SelectItem>
                <SelectItem value="age_desc">{t("sortAgeDesc")}</SelectItem>
                <SelectItem value="breed_asc">{t("sortBreedAsc")}</SelectItem>
                <SelectItem value="camp_asc">{t("sortCampAsc")}</SelectItem>
                <SelectItem value="sex_asc">{t("sortSexMale")}</SelectItem>
                <SelectItem value="sex_desc">{t("sortSexFemale")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-11 px-4 rounded-xl border-border/80 bg-card shadow-sm relative",
                advancedCount > 0 && "border-primary/40 text-foreground"
              )}
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1.5" />
              {t("advancedFilters")}
              {advancedCount > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
                  {advancedCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
          {[
            { id: "all", label: t("all") },
            { id: "castrated", label: t("castrated") },
            { id: "intact", label: t("intactMales") },
            { id: "pregnant", label: t("pregnant") },
            { id: "calves", label: t("calves") },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => (chip.id === "all" ? clearAll() : applyPreset(chip.id))}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                activePreset === chip.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/80 bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30"
              )}
            >
              {chip.label}
            </button>
          ))}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              {t("clearFilters")}
            </button>
          )}
        </div>
      </div>

      {/* Right filter drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 transition-opacity duration-200",
          filtersOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        aria-hidden={!filtersOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
          aria-label={t("cancel")}
          onClick={() => setFiltersOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="animals-filter-title"
          className={cn(
            "absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background shadow-2xl border-l transition-transform duration-300 ease-out",
            filtersOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2
                id="animals-filter-title"
                className="text-lg font-semibold tracking-tight"
              >
                {t("advancedFilters")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("animalsFilterDrawerHelp")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("cancel")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("eartagColor")}
              </Label>
              <TagColorFilter
                value={filters.tagColor === "all" ? null : filters.tagColor}
                onChange={(code) => updateFilter("tagColor", code || "all")}
                showHelp={false}
              />
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("sex")}
              </Label>
              <ChoicePills
                options={[
                  { value: "all", label: t("all") },
                  { value: "MALE", label: t("male") },
                  { value: "FEMALE", label: t("female") },
                  { value: "UNKNOWN", label: t("unknownSex") },
                ]}
                value={filters.sex}
                onChange={(v) => updateFilter("sex", v)}
              />
              {filters.sex === "MALE" && (
                <ChoicePills
                  options={[
                    { value: "all", label: t("all") },
                    { value: "true", label: t("castrated") },
                    { value: "false", label: t("intactMales") },
                  ]}
                  value={filters.castrated}
                  onChange={(v) => updateFilter("castrated", v)}
                />
              )}
              {filters.sex === "FEMALE" && (
                <ChoicePills
                  options={[
                    { value: "all", label: t("all") },
                    { value: "true", label: t("pregnant") },
                    { value: "false", label: t("notPregnant") },
                  ]}
                  value={filters.pregnant}
                  onChange={(v) => updateFilter("pregnant", v)}
                />
              )}
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("status")}
              </Label>
              <ChoicePills
                options={[
                  { value: "ACTIVE", label: t("statusActive") },
                  { value: "ALL", label: t("all") },
                  { value: "DECEASED", label: t("statusDeceased") },
                  { value: "SOLD", label: t("statusSold") },
                  { value: "QUARANTINE", label: t("quarantine") },
                  { value: "MISSING", label: t("statusMissing") },
                ]}
                value={filters.status}
                onChange={(v) => updateFilter("status", v)}
              />
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("ageFilter")}
              </Label>
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
                value={ageFilterMode}
                onChange={applyAgeFilterMode}
              />
              {ageFilterMode === "months" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">{t("ageMinMonths")}</p>
                    <Input
                      type="number"
                      min={0}
                      className="h-10 rounded-lg"
                      placeholder="0"
                      value={filters.ageMinMonths}
                      onChange={(e) =>
                        updateFilter("ageMinMonths", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">{t("ageMaxMonths")}</p>
                    <Input
                      type="number"
                      min={0}
                      className="h-10 rounded-lg"
                      placeholder="24"
                      value={filters.ageMaxMonths}
                      onChange={(e) =>
                        updateFilter("ageMaxMonths", e.target.value)
                      }
                    />
                  </div>
                </div>
              )}
              {ageFilterMode === "born" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">{t("bornFrom")}</p>
                    <Input
                      type="date"
                      className="h-10 rounded-lg"
                      value={filters.dobFrom}
                      onChange={(e) => updateFilter("dobFrom", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">{t("bornTo")}</p>
                    <Input
                      type="date"
                      className="h-10 rounded-lg"
                      value={filters.dobTo}
                      onChange={(e) => updateFilter("dobTo", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("breed")}
              </Label>
              <Select value={filters.breed} onValueChange={(v) => updateFilter("breed", v)}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder={t("breed")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allBreeds")}</SelectItem>
                  {breeds.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("camp")}
              </Label>
              <Select value={filters.camp} onValueChange={(v) => updateFilter("camp", v)}>
                <SelectTrigger className="h-10 rounded-lg">
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
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("owner")}
              </Label>
              <Select value={filters.owner} onValueChange={(v) => updateFilter("owner", v)}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder={t("owner")} />
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
            </section>
          </div>

          <div className="border-t px-5 py-4 flex items-center justify-between gap-3 bg-background">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                clearAll();
                setFiltersOpen(true);
              }}
            >
              {t("clearAll")}
            </button>
            <Button
              type="button"
              className="min-w-[7rem]"
              onClick={() => setFiltersOpen(false)}
            >
              {t("apply")}
            </Button>
          </div>
        </aside>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : animals.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">{t("noAnimals")}</p>
      ) : viewMode === "list" ? (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="hidden sm:grid grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem] gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/60 bg-muted/30">
            <span />
            <span>{t("eartag")}</span>
            <span>{t("breed")}</span>
            <span>{t("camp")}</span>
            <span className="text-right">{t("age")}</span>
          </div>
          <ul className="divide-y divide-border/50">
            {animals.map((animal) => (
              <li key={animal.id}>
                <Link
                  href={`/animals/${animal.id}`}
                  className="group grid grid-cols-[3rem_1fr] sm:grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem] gap-3 items-center px-4 py-3 hover:bg-muted/35 transition-colors"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/60">
                    {animal.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={animal.photoUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground/80">
                        {sexShort(animal.sex)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <EartagBadge
                        eartag={animal.eartag}
                        campTagColor={animal.camp.tagColor}
                        animalTagColor={animal.tagColor}
                        defaultTagColor={defaultTagColor}
                        dob={animal.dob}
                        ageMonths={animal.ageMonths}
                        yearColors={yearColors}
                        locale={locale}
                        className="group-hover:text-primary transition-colors"
                      />
                      {animal.hasNotes && (
                        <StickyNote
                          className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                          aria-label={t("hasNotes")}
                        />
                      )}
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                        {sexShort(animal.sex)}
                      </span>
                      <AnimalStatusBadges animal={animal} t={t} />
                    </div>
                    <p className="sm:hidden text-sm text-muted-foreground truncate mt-0.5">
                      {animal.breed} · {animal.camp.name} · {formatAge(animal.ageMonths, ageMode)}
                    </p>
                  </div>

                  <p className="hidden sm:block text-sm text-muted-foreground truncate">
                    {animal.breed}
                  </p>
                  <p className="hidden sm:block text-sm text-muted-foreground truncate">
                    {animal.camp.name}
                  </p>
                  <p className="hidden sm:block text-sm text-muted-foreground text-right tabular-nums">
                    {formatAge(animal.ageMonths, ageMode)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {animals.map((animal) => (
            <Link key={animal.id} href={`/animals/${animal.id}`}>
              <Card className="overflow-hidden h-full border-muted-foreground/10 shadow-none hover:border-muted-foreground/25 transition-colors">
                <div className="aspect-[4/3] bg-muted/50 flex items-center justify-center">
                  {animal.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={animal.photoUrl}
                      alt={animal.eartag}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs tracking-widest text-muted-foreground/50 uppercase">
                      {t("noPhoto")}
                    </span>
                  )}
                </div>
                <div className="p-3.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <EartagBadge
                      eartag={animal.eartag}
                      campTagColor={animal.camp.tagColor}
                      animalTagColor={animal.tagColor}
                      defaultTagColor={defaultTagColor}
                      dob={animal.dob}
                      ageMonths={animal.ageMonths}
                      yearColors={yearColors}
                      locale={locale}
                    />
                    <div className="flex gap-1 flex-wrap justify-end">
                      {animal.hasNotes && (
                        <StickyNote
                          className="h-3.5 w-3.5 text-muted-foreground"
                          aria-label={t("hasNotes")}
                        />
                      )}
                      <Badge variant="secondary" className="font-normal text-[10px] px-1.5">
                        {sexShort(animal.sex)}
                      </Badge>
                      <AnimalStatusBadges animal={animal} t={t} />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{animal.breed}</p>
                  <p className="text-xs text-muted-foreground/80">
                    {animal.camp.name} · {formatAge(animal.ageMonths, ageMode)}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!loading && (
        <ListPagination
          total={total}
          limit={PAGE_SIZE}
          offset={offset}
          loading={loadingPage}
          onPrev={() => loadPage(Math.max(0, offset - PAGE_SIZE), { soft: true })}
          onNext={() => loadPage(offset + PAGE_SIZE, { soft: true })}
        />
      )}
    </div>
  );
}

export default function AnimalsPage() {
  const t = useT();
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{t("loading")}</p>}>
      <AnimalsPageContent />
    </Suspense>
  );
}
