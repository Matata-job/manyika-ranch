"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { cn, formatAge, type AgeDisplayMode } from "@/lib/utils";
import { useT } from "@/components/providers/locale-provider";

interface Animal {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  isCastrated?: boolean;
  isPregnant?: boolean;
  ageMonths: number | null;
  status: string;
  photoUrl: string | null;
  camp: { id: string; name: string };
  owner: { id: string; name: string };
}

type Filters = {
  search: string;
  sex: string;
  breed: string;
  camp: string;
  ageGroup: string;
  status: string;
  owner: string;
  castrated: string;
  pregnant: string;
  sort: string;
};

const DEFAULTS: Filters = {
  search: "",
  sex: "all",
  breed: "all",
  camp: "all",
  ageGroup: "all",
  status: "ACTIVE",
  owner: "all",
  castrated: "all",
  pregnant: "all",
  sort: "eartag_asc",
};

const ADVANCED_KEYS: (keyof Filters)[] = [
  "sex",
  "breed",
  "camp",
  "ageGroup",
  "status",
  "owner",
  "castrated",
  "pregnant",
];

function filtersFromParams(params: URLSearchParams): Filters {
  return {
    search: params.get("search") || "",
    sex: params.get("sex") || "all",
    breed: params.get("breed") || "all",
    camp: params.get("camp") || "all",
    ageGroup: params.get("ageGroup") || "all",
    status: params.get("status") || "ACTIVE",
    owner: params.get("owner") || "all",
    castrated: params.get("castrated") || "all",
    pregnant: params.get("pregnant") || "all",
    sort: params.get("sort") || "eartag_asc",
  };
}

function AnimalsPageContent() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role;
  const canCreate = role && hasPermission(role, "createAnimal");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [breeds, setBreeds] = useState<{ id: string; name: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [ageMode, setAgeMode] = useState<AgeDisplayMode>("AUTO");
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(searchParams));
  const [searchInput, setSearchInput] = useState(filters.search);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const next = filtersFromParams(searchParams);
    setFilters(next);
    setSearchInput(searchParams.get("search") || "");
    const hasAdvanced = ADVANCED_KEYS.some((k) => next[k] !== DEFAULTS[k]);
    if (hasAdvanced) setFiltersOpen(true);
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
    setFilters(next);
    setSearchInput("");
    syncUrl(next);
  }

  function clearAll() {
    setFilters(DEFAULTS);
    setSearchInput("");
    setFiltersOpen(false);
    syncUrl(DEFAULTS);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === filters.search) return;
      const next = { ...filters, search: searchInput };
      setFilters(next);
      syncUrl(next);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.camp !== "all") params.set("camp", filters.camp);
    if (filters.sex !== "all") params.set("sex", filters.sex);
    if (filters.breed !== "all") params.set("breed", filters.breed);
    if (filters.ageGroup !== "all") params.set("ageGroup", filters.ageGroup);
    if (filters.status) params.set("status", filters.status);
    if (filters.owner !== "all") params.set("owner", filters.owner);
    if (filters.castrated !== "all") params.set("castrated", filters.castrated);
    if (filters.pregnant !== "all") params.set("pregnant", filters.pregnant);
    if (filters.sort) params.set("sort", filters.sort);

    fetch(`/api/animals?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAnimals(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [filters]);

  const advancedCount = useMemo(
    () => ADVANCED_KEYS.filter((k) => filters[k] !== DEFAULTS[k]).length,
    [filters]
  );

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
          <h1 className="text-3xl font-semibold tracking-tight">{t("animalsTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? t("loading")
              : `${animals.length} animal${animals.length === 1 ? "" : "s"}`}
            {hasActiveFilters && !loading ? " · filtered" : ""}
            {animals.length >= 300 ? " · first 300" : ""}
          </p>
        </div>
        {canCreate && (
          <Link href="/animals/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              {t("addAnimal")}
            </Button>
          </Link>
        )}
      </div>

      {/* Minimal toolbar: search + sort + filters toggle */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder={t("searchEartagBreed")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-10 border-muted-foreground/20 bg-background shadow-none"
            />
          </div>
          <Select value={filters.sort} onValueChange={(v) => updateFilter("sort", v)}>
            <SelectTrigger className="h-10 w-full sm:w-[180px] border-muted-foreground/20 shadow-none">
              <SelectValue placeholder={t("sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eartag_asc">Eartag A–Z</SelectItem>
              <SelectItem value="eartag_desc">Eartag Z–A</SelectItem>
              <SelectItem value="age_asc">Youngest first</SelectItem>
              <SelectItem value="age_desc">Oldest first</SelectItem>
              <SelectItem value="breed_asc">Breed A–Z</SelectItem>
              <SelectItem value="sex_asc">Males first</SelectItem>
              <SelectItem value="sex_desc">Females first</SelectItem>
              <SelectItem value="camp_asc">Camp A–Z</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-10 px-3 border-muted-foreground/20 shadow-none",
              (filtersOpen || advancedCount > 0) && "border-foreground/30 bg-muted/40"
            )}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <SlidersHorizontal className="h-4 w-4 mr-1.5" />
            {t("advancedFilters")}
            {advancedCount > 0 && (
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {advancedCount}
              </span>
            )}
          </Button>
        </div>

        {/* Quiet quick presets */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
          {[
            { id: "all", label: t("all") },
            { id: "castrated", label: t("castrated") },
            { id: "intact", label: "Intact" },
            { id: "pregnant", label: t("pregnant") },
            { id: "calves", label: t("calves") },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => (chip.id === "all" ? clearAll() : applyPreset(chip.id))}
              className={cn(
                "shrink-0 px-3 py-1 text-xs tracking-wide transition-colors",
                activePreset === chip.id
                  ? "text-foreground font-medium underline underline-offset-4 decoration-foreground/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {chip.label}
            </button>
          ))}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="shrink-0 px-2 py-1 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              {t("clearFilters")}
            </button>
          )}
        </div>

        {/* Advanced filters — hidden by default */}
        {filtersOpen && (
          <div className="rounded-lg border border-muted-foreground/15 bg-muted/20 p-4 space-y-3 animate-in fade-in-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              <Select value={filters.sex} onValueChange={(v) => updateFilter("sex", v)}>
                <SelectTrigger className="h-9 bg-background border-muted-foreground/15 shadow-none">
                  <SelectValue placeholder={t("sex")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sexes</SelectItem>
                  <SelectItem value="MALE">{t("male")}</SelectItem>
                  <SelectItem value="FEMALE">{t("female")}</SelectItem>
                  <SelectItem value="UNKNOWN">{t("unknownSex")}</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.castrated}
                onValueChange={(v) => updateFilter("castrated", v)}
                disabled={filters.sex === "FEMALE" || filters.sex === "UNKNOWN"}
              >
                <SelectTrigger className="h-9 bg-background border-muted-foreground/15 shadow-none">
                  <SelectValue placeholder="Male status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Male status</SelectItem>
                  <SelectItem value="true">{t("castrated")}</SelectItem>
                  <SelectItem value="false">Intact</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.pregnant}
                onValueChange={(v) => updateFilter("pregnant", v)}
                disabled={filters.sex === "MALE" || filters.sex === "UNKNOWN"}
              >
                <SelectTrigger className="h-9 bg-background border-muted-foreground/15 shadow-none">
                  <SelectValue placeholder="Female status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Female status</SelectItem>
                  <SelectItem value="true">{t("pregnant")}</SelectItem>
                  <SelectItem value="false">Not pregnant</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.breed} onValueChange={(v) => updateFilter("breed", v)}>
                <SelectTrigger className="h-9 bg-background border-muted-foreground/15 shadow-none">
                  <SelectValue placeholder={t("breed")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All breeds</SelectItem>
                  {breeds.map((b) => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.camp} onValueChange={(v) => updateFilter("camp", v)}>
                <SelectTrigger className="h-9 bg-background border-muted-foreground/15 shadow-none">
                  <SelectValue placeholder={t("camp")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All camps</SelectItem>
                  {camps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.ageGroup} onValueChange={(v) => updateFilter("ageGroup", v)}>
                <SelectTrigger className="h-9 bg-background border-muted-foreground/15 shadow-none">
                  <SelectValue placeholder={t("ageGroup")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ages</SelectItem>
                  <SelectItem value="calf">{t("calves")}</SelectItem>
                  <SelectItem value="yearling">{t("weaners")}</SelectItem>
                  <SelectItem value="adult">{t("adults")}</SelectItem>
                  <SelectItem value="mature">Mature (5y+)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
                <SelectTrigger className="h-9 bg-background border-muted-foreground/15 shadow-none">
                  <SelectValue placeholder={t("status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">{t("active")}</SelectItem>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="DECEASED">{t("deceased")}</SelectItem>
                  <SelectItem value="QUARANTINE">{t("quarantine")}</SelectItem>
                  <SelectItem value="SOLD">{t("sold")}</SelectItem>
                  <SelectItem value="MISSING">Missing</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.owner} onValueChange={(v) => updateFilter("owner", v)}>
                <SelectTrigger className="h-9 bg-background border-muted-foreground/15 shadow-none">
                  <SelectValue placeholder={t("owner")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : animals.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          {t("noAnimals")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {animals.map((animal) => (
            <Link key={animal.id} href={`/animals/${animal.id}`}>
              <Card className="overflow-hidden h-full border-muted-foreground/10 shadow-none hover:border-muted-foreground/25 transition-colors">
                <div className="aspect-[4/3] bg-muted/50 flex items-center justify-center">
                  {animal.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={animal.photoUrl} alt={animal.eartag} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs tracking-widest text-muted-foreground/50 uppercase">
                      No photo
                    </span>
                  )}
                </div>
                <div className="p-3.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium tracking-tight">{animal.eartag}</h3>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <Badge variant="secondary" className="font-normal text-[10px] px-1.5">
                        {animal.sex === "MALE"
                          ? "M"
                          : animal.sex === "FEMALE"
                            ? "F"
                            : "?"}
                      </Badge>
                      {animal.sex === "MALE" && animal.isCastrated && (
                        <Badge variant="outline" className="font-normal text-[10px] px-1.5">
                          {t("castrated")}
                        </Badge>
                      )}
                      {animal.sex === "FEMALE" && animal.isPregnant && (
                        <Badge variant="warning" className="font-normal text-[10px] px-1.5">
                          {t("pregnant")}
                        </Badge>
                      )}
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
