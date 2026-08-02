"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate } from "@/lib/utils";
import { parseAnimalsList } from "@/lib/animals-api";
import { Plus } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import {
  BREEDING_ELIGIBLE_MONTHS,
  herdPlanBadgeVariant,
  herdPlanLabelKey,
  isBreedingEligibleAge,
  type HerdPlanValue,
} from "@/lib/herd-plan";

interface BreedingEvent {
  id: string;
  matingDate: string;
  method: string;
  pregnancyConfirmed: boolean;
  dam: { id: string; eartag: string; isPregnant?: boolean };
  sire: { id: string; eartag: string } | null;
  calving: {
    id: string;
    date: string;
    calf: { id: string; eartag: string } | null;
  } | null;
}

type AnimalRow = {
  id: string;
  eartag: string;
  sex: string;
  breed?: string;
  ageMonths?: number | null;
  herdPlan?: HerdPlanValue;
  herdPlanNote?: string | null;
  isCastrated?: boolean;
  camp?: { id: string; name: string };
};

type Filters = {
  camp: string;
  sex: string;
  ageGroup: string;
  ageMinMonths: string;
  ageMaxMonths: string;
  search: string;
};

const DEFAULT_FILTERS: Filters = {
  camp: "all",
  sex: "all",
  ageGroup: "all",
  ageMinMonths: "",
  ageMaxMonths: "",
  search: "",
};

export default function BreedingPage() {
  const t = useT();
  const { data: session } = useSession();
  const canPlan = session?.user?.role
    ? hasPermission(session.user.role as Role, "updateAnimalRecords")
    : false;

  const [events, setEvents] = useState<BreedingEvent[]>([]);
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    updated: number;
    skipped: number;
  } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [calvingEventId, setCalvingEventId] = useState<string | null>(null);
  const [form, setForm] = useState({
    damId: "",
    sireId: "",
    matingDate: "",
    method: "NATURAL",
    pregnancyConfirmed: false,
  });
  const [calvingForm, setCalvingForm] = useState({
    date: "",
    calfEartag: "",
    calfSex: "FEMALE",
    birthWeightKg: "",
    createCalf: true,
  });

  async function loadEvents() {
    const res = await fetch("/api/breeding");
    if (res.ok) setEvents(await res.json());
  }

  const loadAnimals = useCallback(async (f: Filters) => {
    setLoadingAnimals(true);
    const params = new URLSearchParams({
      status: "ACTIVE",
      limit: "5000",
      sort: "eartag_asc",
    });
    if (f.camp !== "all") params.set("camp", f.camp);
    if (f.sex !== "all") params.set("sex", f.sex);
    if (f.search.trim()) params.set("search", f.search.trim());
    if (f.ageMinMonths || f.ageMaxMonths) {
      if (f.ageMinMonths) params.set("ageMinMonths", f.ageMinMonths);
      if (f.ageMaxMonths) params.set("ageMaxMonths", f.ageMaxMonths);
    } else if (f.ageGroup !== "all") {
      params.set("ageGroup", f.ageGroup);
    }
    try {
      const res = await fetch(`/api/animals?${params}`);
      const data = res.ok ? await res.json() : null;
      setAnimals(parseAnimalsList<AnimalRow>(data));
    } catch {
      setAnimals([]);
    } finally {
      setSelected(new Set());
      setBulkResult(null);
      setLoadingAnimals(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : d.camps || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAnimals(filters);
  }, [filters, loadAnimals]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((prev) =>
        prev.search === searchInput ? prev : { ...prev, search: searchInput }
      );
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "ageGroup" && value !== "all") {
        next.ageMinMonths = "";
        next.ageMaxMonths = "";
      }
      if (
        (key === "ageMinMonths" || key === "ageMaxMonths") &&
        String(value).trim() !== ""
      ) {
        next.ageGroup = "all";
      }
      return next;
    });
  }

  async function submitBreeding(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/breeding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({
      damId: "",
      sireId: "",
      matingDate: "",
      method: "NATURAL",
      pregnancyConfirmed: false,
    });
    loadEvents();
  }

  async function submitCalving(e: React.FormEvent) {
    e.preventDefault();
    if (!calvingEventId) return;
    const event = events.find((ev) => ev.id === calvingEventId);
    await fetch(`/api/breeding/${calvingEventId}/calving`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...calvingForm,
        damId: event?.dam.id,
        sireId: event?.sire?.id,
        birthWeightKg: calvingForm.birthWeightKg
          ? parseFloat(calvingForm.birthWeightKg)
          : null,
      }),
    });
    setCalvingEventId(null);
    loadEvents();
    loadAnimals(filters);
  }

  async function patchBreeding(
    id: string,
    body: { pregnancyConfirmed?: boolean; clearPregnancy?: boolean }
  ) {
    await fetch(`/api/breeding/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    loadEvents();
  }

  async function applyBulkPlan(plan: HerdPlanValue) {
    if (selected.size === 0) return;
    let note: string | null | undefined;
    if (plan !== "EXCLUDED") {
      const entered = window.prompt(t("optionalPlanningNote"), "") ?? "";
      note = entered.trim() || null;
    } else {
      note = null;
    }
    setBulkSaving(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/animals/herd-plan/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalIds: [...selected],
          herdPlan: plan,
          herdPlanNote: note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error || t("failedToSave"));
        return;
      }
      setBulkResult({
        updated: data.updated ?? 0,
        skipped: data.skipped ?? 0,
      });
      await loadAnimals(filters);
    } finally {
      setBulkSaving(false);
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    if (selected.size === animals.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(animals.map((a) => a.id)));
    }
  }

  const keepReady = useMemo(
    () =>
      animals.filter(
        (a) =>
          a.herdPlan === "KEEP_BREEDING" &&
          isBreedingEligibleAge(a.ageMonths)
      ),
    [animals]
  );
  const keepFuture = useMemo(
    () =>
      animals.filter(
        (a) =>
          a.herdPlan === "KEEP_BREEDING" &&
          !isBreedingEligibleAge(a.ageMonths)
      ),
    [animals]
  );

  const matingDams = useMemo(
    () =>
      animals.filter(
        (a) => a.sex === "FEMALE" && isBreedingEligibleAge(a.ageMonths)
      ),
    [animals]
  );
  const matingSires = useMemo(
    () =>
      animals.filter(
        (a) =>
          a.sex === "MALE" &&
          !a.isCastrated &&
          isBreedingEligibleAge(a.ageMonths)
      ),
    [animals]
  );

  function planRow(a: AnimalRow) {
    return (
      <div
        key={a.id}
        className="flex items-center justify-between border-b pb-2 gap-2"
      >
        <div className="min-w-0">
          <Link
            href={`/animals/${a.id}`}
            className="font-medium text-primary hover:underline"
          >
            {a.eartag}
          </Link>
          <p className="text-sm text-muted-foreground truncate">
            {a.breed} · {a.sex}
            {a.ageMonths != null ? ` · ${a.ageMonths}m` : ""}
            {a.isCastrated ? ` · ${t("castrated")}` : ""}
            {a.camp?.name ? ` · ${a.camp.name}` : ""}
            {a.herdPlanNote ? ` · ${a.herdPlanNote}` : ""}
          </p>
        </div>
        {a.herdPlan && a.herdPlan !== "EXCLUDED" && (
          <Badge variant={herdPlanBadgeVariant(a.herdPlan)}>
            {t(herdPlanLabelKey(a.herdPlan))}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("breedingTitle")}</h1>
          <p className="text-muted-foreground">{t("breedingSubtitle")}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Camps usually run with bulls together. Mark pregnancy only when you
            confirm it; record calving (or clear pregnancy) when the cow is open
            again after breeding season or birth. Mating from{" "}
            {BREEDING_ELIGIBLE_MONTHS} months.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Record Mating
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("breedingFilters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("camp")}</p>
              <Select
                value={filters.camp}
                onValueChange={(v) => updateFilter("camp", v)}
              >
                <SelectTrigger>
                  <SelectValue />
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
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("sex")}</p>
              <Select
                value={filters.sex}
                onValueChange={(v) => updateFilter("sex", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allSexes")}</SelectItem>
                  <SelectItem value="FEMALE">{t("female")}</SelectItem>
                  <SelectItem value="MALE">{t("male")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("ageGroup")}</p>
              <Select
                value={filters.ageGroup}
                onValueChange={(v) => updateFilter("ageGroup", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allAges")}</SelectItem>
                  <SelectItem value="calf">{t("calves")}</SelectItem>
                  <SelectItem value="yearling">{t("weaners")}</SelectItem>
                  <SelectItem value="adult">{t("adults")}</SelectItem>
                  <SelectItem value="mature">{t("ageMature")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("ageMinMonths")}</p>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={filters.ageMinMonths}
                onChange={(e) => updateFilter("ageMinMonths", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("ageMaxMonths")}</p>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 18"
                value={filters.ageMaxMonths}
                onChange={(e) => updateFilter("ageMaxMonths", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("search")}</p>
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("searchEartag")}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t("breedingCustomAgeHelp")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("suggestedBreedingStock")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t("suggestedBreedingStockHelp", { n: BREEDING_ELIGIBLE_MONTHS })}
            </p>
            {keepReady.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noKeepForBreeding")}
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {keepReady.map(planRow)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("futureReplacements")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t("futureReplacementsHelp", { n: BREEDING_ELIGIBLE_MONTHS })}
            </p>
            {keepFuture.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noFutureReplacements")}
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {keepFuture.map(planRow)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {canPlan && (
        <Card>
          <CardHeader>
            <CardTitle>{t("bulkHerdPlan")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("bulkHerdPlanHelp")}
            </p>
            {bulkResult && (
              <p className="text-sm text-green-700">
                {t("bulkHerdPlanResult", {
                  n: bulkResult.updated,
                  skipped: bulkResult.skipped,
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={animals.length === 0 || loadingAnimals}
                onClick={toggleAllVisible}
              >
                {selected.size === animals.length && animals.length > 0
                  ? t("deselectAll")
                  : t("selectAll")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={selected.size === 0 || bulkSaving}
                onClick={() => applyBulkPlan("KEEP_BREEDING")}
              >
                {t("herdPlanKeepBreeding")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={selected.size === 0 || bulkSaving}
                onClick={() => applyBulkPlan("SELL_NEXT_CYCLE")}
              >
                {t("herdPlanSellNextCycle")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={selected.size === 0 || bulkSaving}
                onClick={() => applyBulkPlan("EXCLUDED")}
              >
                {t("clearHerdPlan")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("selectedCount", { n: selected.size, total: animals.length })}
            </p>
            {loadingAnimals ? (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            ) : animals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noAnimalsInFilter")}
              </p>
            ) : (
              <div className="rounded-lg border max-h-72 overflow-y-auto divide-y">
                {animals.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleOne(a.id)}
                    />
                    <span className="font-medium">{a.eartag}</span>
                    <span className="text-muted-foreground truncate">
                      {a.breed} · {a.sex}
                      {a.ageMonths != null ? ` · ${a.ageMonths}m` : ""}
                      {a.camp?.name ? ` · ${a.camp.name}` : ""}
                    </span>
                    {a.herdPlan && a.herdPlan !== "EXCLUDED" && (
                      <Badge
                        variant={herdPlanBadgeVariant(a.herdPlan)}
                        className="ml-auto shrink-0"
                      >
                        {t(herdPlanLabelKey(a.herdPlan))}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Breeding Event</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={submitBreeding}
              className="grid gap-4 sm:grid-cols-2 max-w-lg"
            >
              <div className="space-y-2">
                <Label>{t("dam")}</Label>
                <Select
                  value={form.damId}
                  onValueChange={(v) => setForm({ ...form, damId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select dam" />
                  </SelectTrigger>
                  <SelectContent>
                    {matingDams.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.eartag}
                        {a.ageMonths != null ? ` (${a.ageMonths}m)` : ""}
                        {a.herdPlan === "KEEP_BREEDING" ? ` ★` : ""}
                        {a.herdPlan === "SELL_NEXT_CYCLE" ? ` ⚠` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("matingAgeHelp", { n: BREEDING_ELIGIBLE_MONTHS })}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t("sire")}</Label>
                <Select
                  value={form.sireId}
                  onValueChange={(v) => setForm({ ...form, sireId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sire" />
                  </SelectTrigger>
                  <SelectContent>
                    {matingSires.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.eartag}
                        {a.ageMonths != null ? ` (${a.ageMonths}m)` : ""}
                        {a.herdPlan === "KEEP_BREEDING" ? ` ★` : ""}
                        {a.herdPlan === "SELL_NEXT_CYCLE" ? ` ⚠` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("matingDate")}</Label>
                <Input
                  type="date"
                  value={form.matingDate}
                  onChange={(e) =>
                    setForm({ ...form, matingDate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select
                  value={form.method}
                  onValueChange={(v) => setForm({ ...form, method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NATURAL">Natural</SelectItem>
                    <SelectItem value="AI">Artificial Insemination</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.pregnancyConfirmed}
                  onChange={(e) =>
                    setForm({ ...form, pregnancyConfirmed: e.target.checked })
                  }
                />
                Pregnancy already confirmed (marks dam pregnant)
              </label>
              <Button type="submit" className="sm:col-span-2">
                Save
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {calvingEventId && (
        <Card>
          <CardHeader>
            <CardTitle>Record Calving</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={submitCalving}
              className="grid gap-4 sm:grid-cols-2 max-w-lg"
            >
              <div className="space-y-2">
                <Label>Calving Date</Label>
                <Input
                  type="date"
                  value={calvingForm.date}
                  onChange={(e) =>
                    setCalvingForm({ ...calvingForm, date: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Calf Eartag</Label>
                <Input
                  value={calvingForm.calfEartag}
                  onChange={(e) =>
                    setCalvingForm({
                      ...calvingForm,
                      calfEartag: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Calf Sex</Label>
                <Select
                  value={calvingForm.calfSex}
                  onValueChange={(v) =>
                    setCalvingForm({ ...calvingForm, calfSex: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Birth Weight (kg)</Label>
                <Input
                  type="number"
                  value={calvingForm.birthWeightKg}
                  onChange={(e) =>
                    setCalvingForm({
                      ...calvingForm,
                      birthWeightKg: e.target.value,
                    })
                  }
                />
              </div>
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Recording calving clears the dam&apos;s pregnant flag
                automatically.
              </p>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">Record Calving</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCalvingEventId(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Breeding Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noBreeding")}</p>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3"
                >
                  <div>
                    <p className="font-medium">
                      <Link
                        href={`/animals/${ev.dam.id}`}
                        className="text-primary hover:underline"
                      >
                        {ev.dam.eartag}
                      </Link>
                      {ev.sire && (
                        <>
                          {" "}
                          ×{" "}
                          <Link
                            href={`/animals/${ev.sire.id}`}
                            className="text-primary hover:underline"
                          >
                            {ev.sire.eartag}
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(ev.matingDate)} · {ev.method}
                      {ev.pregnancyConfirmed && ` · ${t("pregnant")}`}
                      {ev.dam.isPregnant && !ev.calving && " · dam flag: pregnant"}
                    </p>
                    {ev.calving && (
                      <p className="text-sm text-green-700">
                        Calved {formatDate(ev.calving.date)}
                        {ev.calving.calf && (
                          <> · Calf: {ev.calving.calf.eartag}</>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {!ev.calving && (
                      <>
                        {!ev.pregnancyConfirmed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              patchBreeding(ev.id, { pregnancyConfirmed: true })
                            }
                          >
                            Confirm pregnant
                          </Button>
                        )}
                        {(ev.pregnancyConfirmed || ev.dam.isPregnant) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              patchBreeding(ev.id, { clearPregnancy: true })
                            }
                          >
                            Mark open
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCalvingEventId(ev.id)}
                        >
                          Record Calving
                        </Button>
                      </>
                    )}
                    {ev.calving ? (
                      <Badge variant="success">Calved</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
