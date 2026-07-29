"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { formatAge, type AgeDisplayMode } from "@/lib/utils";

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

  useEffect(() => {
    setFilters(filtersFromParams(searchParams));
    setSearchInput(searchParams.get("search") || "");
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
    // Keep sex consistent with castrated / pregnant shortcuts
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
    } else if (preset === "intact") {
      next = { ...DEFAULTS, sex: "MALE", castrated: "false" };
    } else if (preset === "pregnant") {
      next = { ...DEFAULTS, sex: "FEMALE", pregnant: "true" };
    } else if (preset === "calves") {
      next = { ...DEFAULTS, ageGroup: "calf" };
    }
    setFilters(next);
    setSearchInput("");
    syncUrl(next);
  }

  function clearAll() {
    setFilters(DEFAULTS);
    setSearchInput("");
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Animals</h1>
          <p className="text-muted-foreground">
            {loading ? "Loading..." : `${animals.length} animal${animals.length === 1 ? "" : "s"}`}
            {hasActiveFilters && !loading ? " (filtered)" : ""}
            {animals.length >= 300 ? " · showing first 300" : ""}
          </p>
        </div>
        {canCreate && (
          <Link href="/animals/new">
            <Button><Plus className="h-4 w-4 mr-2" />Add Animal</Button>
          </Link>
        )}
      </div>

      {/* Quick chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "all", label: "All" },
          { id: "castrated", label: "Castrated bulls" },
          { id: "intact", label: "Intact bulls" },
          { id: "pregnant", label: "Pregnant" },
          { id: "calves", label: "Calves" },
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => (chip.id === "all" ? clearAll() : applyPreset(chip.id))}
            className={`shrink-0 px-3 py-1.5 text-sm rounded-full border transition-colors ${
              activePreset === chip.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-border"
            }`}
          >
            {chip.label}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 px-3 py-1.5 text-sm rounded-full border border-border inline-flex items-center gap-1 hover:bg-muted"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by eartag or breed..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
          <Select value={filters.sex} onValueChange={(v) => updateFilter("sex", v)}>
            <SelectTrigger><SelectValue placeholder="Sex" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sexes</SelectItem>
              <SelectItem value="MALE">Male</SelectItem>
              <SelectItem value="FEMALE">Female</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.castrated}
            onValueChange={(v) => updateFilter("castrated", v)}
            disabled={filters.sex === "FEMALE"}
          >
            <SelectTrigger><SelectValue placeholder="Male status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All males</SelectItem>
              <SelectItem value="true">Castrated</SelectItem>
              <SelectItem value="false">Intact</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.pregnant}
            onValueChange={(v) => updateFilter("pregnant", v)}
            disabled={filters.sex === "MALE"}
          >
            <SelectTrigger><SelectValue placeholder="Female status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All females</SelectItem>
              <SelectItem value="true">Pregnant</SelectItem>
              <SelectItem value="false">Not pregnant</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.breed} onValueChange={(v) => updateFilter("breed", v)}>
            <SelectTrigger><SelectValue placeholder="Breed" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All breeds</SelectItem>
              {breeds.map((b) => (
                <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.camp} onValueChange={(v) => updateFilter("camp", v)}>
            <SelectTrigger><SelectValue placeholder="Camp" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All camps</SelectItem>
              {camps.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.ageGroup} onValueChange={(v) => updateFilter("ageGroup", v)}>
            <SelectTrigger><SelectValue placeholder="Age" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ages</SelectItem>
              <SelectItem value="calf">Calves (&lt;1y)</SelectItem>
              <SelectItem value="yearling">Yearlings (1–2y)</SelectItem>
              <SelectItem value="adult">Adults (2–5y)</SelectItem>
              <SelectItem value="mature">Mature (5y+)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="DECEASED">Deceased</SelectItem>
              <SelectItem value="QUARANTINE">Quarantine</SelectItem>
              <SelectItem value="SOLD">Sold</SelectItem>
              <SelectItem value="MISSING">Missing</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.owner} onValueChange={(v) => updateFilter("owner", v)}>
            <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.sort} onValueChange={(v) => updateFilter("sort", v)}>
            <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="eartag_asc">Eartag A–Z</SelectItem>
              <SelectItem value="eartag_desc">Eartag Z–A</SelectItem>
              <SelectItem value="age_asc">Age: youngest</SelectItem>
              <SelectItem value="age_desc">Age: oldest</SelectItem>
              <SelectItem value="breed_asc">Breed A–Z</SelectItem>
              <SelectItem value="sex_asc">Sex: Male first</SelectItem>
              <SelectItem value="sex_desc">Sex: Female first</SelectItem>
              <SelectItem value="camp_asc">Camp A–Z</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : animals.length === 0 ? (
        <p className="text-muted-foreground">No animals match these filters.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {animals.map((animal) => (
            <Link key={animal.id} href={`/animals/${animal.id}`}>
              <Card className="hover:shadow-md transition-shadow overflow-hidden h-full">
                <div className="aspect-video bg-muted flex items-center justify-center">
                  {animal.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={animal.photoUrl} alt={animal.eartag} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl text-muted-foreground">🐄</span>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-bold">{animal.eartag}</h3>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="secondary">{animal.sex}</Badge>
                      {animal.sex === "MALE" && animal.isCastrated && (
                        <Badge variant="outline">Castrated</Badge>
                      )}
                      {animal.sex === "FEMALE" && animal.isPregnant && (
                        <Badge variant="warning">Pregnant</Badge>
                      )}
                      {animal.status !== "ACTIVE" && (
                        <Badge variant="destructive">{animal.status}</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{animal.breed}</p>
                  <p className="text-xs text-muted-foreground">
                    {animal.camp.name} · {formatAge(animal.ageMonths, ageMode)} · {animal.owner.name}
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
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading animals...</p>}>
      <AnimalsPageContent />
    </Suspense>
  );
}
