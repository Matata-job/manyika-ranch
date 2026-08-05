"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Columns3, Filter, LayoutGrid, List, Pencil, Plus, Search, StickyNote } from "lucide-react";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { useLocale, useT } from "@/components/providers/locale-provider";
import { TAG_COLORS, resolveTagColor, tagColorLabel } from "@/lib/tag-color";
import { EartagBadge, TagColorSwatch } from "@/components/eartag-badge";
import { OptionalSection } from "@/components/optional-section";
import { ZoomableCampImage } from "@/components/zoomable-camp-image";
import {
  CampPhotoGallery,
  type CampPhoto,
} from "@/components/camp-photo-gallery";
import { TagColorFilter } from "@/components/animals/tag-color-filter";
import { HerdPlanFilter } from "@/components/animals/herd-plan-filter";
import { MultiTogglePills } from "@/components/animals/multi-toggle-pills";
import {
  CustomizeColumnsPanel,
  loadColumnPrefs,
  type AnimalColumnId,
} from "@/components/animals/customize-columns";
import { ChoicePills } from "@/components/choice-pills";
import { parseAnimalsList } from "@/lib/animals-api";
import { joinMultiParam } from "@/lib/multi-filter";
import {
  boundaryAreaCount,
  boundaryPointCount,
  boundaryTotalAcresUnion,
  formatAcresEstimate,
  parseBoundary,
  type CampBoundary,
} from "@/lib/camp-boundary";
import { herdPlanBadgeVariant, herdPlanLabelKey } from "@/lib/herd-plan";
import { lifecycleKind, lifecycleLabelKey } from "@/lib/lifecycle";
import { cn, formatDate } from "@/lib/utils";

function todayInputDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatNoteDate(value: string | Date, locale: string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(locale === "sw" ? "sw-TZ" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type CampJournalNote = {
  id: string;
  body: string;
  noteDate: string;
  createdAt: string;
  author: { id: string; name: string } | null;
};

const CampMapPanel = dynamic(
  () => import("@/components/camp-map-panel").then((m) => m.CampMapPanel),
  { ssr: false }
);

interface CampDetail {
  id: string;
  name: string;
  code?: string | null;
  tagColor?: string | null;
  legacyCode?: string | null;
  latitude: number | null;
  longitude: number | null;
  boundary?: unknown;
  sizeAcres: number | null;
  logoUrl: string | null;
  waterSources: string | null;
  notes: string | null;
  isActive?: boolean;
  animals: {
    id: string;
    eartag: string;
    breed: string;
    sex: string;
    ageMonths: number | null;
  }[];
  animalTotal?: number;
  animalsLimit?: number;
  animalsOffset?: number;
  animalsHasMore?: boolean;
  bySex?: Record<string, number>;
  _count?: { animals: number };
  assignments: { user: { name: string; role: string } }[];
  photos: CampPhoto[];
  journalNotes?: CampJournalNote[];
}

type CampAnimal = {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  status: string;
  ageMonths: number | null;
  dob?: string | null;
  dateOfBirth?: string | null;
  isCastrated?: boolean | null;
  isPregnant?: boolean | null;
  tagColor?: string | null;
  rfidChip?: string | null;
  herdPlan?: "EXCLUDED" | "KEEP_BREEDING" | "SELL_NEXT_CYCLE" | "KULIMA";
  photoUrl?: string | null;
  camp?: { id: string; name: string; tagColor?: string | null };
  owner?: { id: string; name: string } | null;
  sire?: { id: string; eartag: string } | null;
  dam?: { id: string; eartag: string } | null;
};

type CampAnimalFilters = {
  search: string;
  sex: string;
  breeds: string[];
  owners: string[];
  status: string;
  herdPlan: string;
  castrated: string;
  pregnant: string;
  ageGroup: string;
  ageMinMonths: string;
  ageMaxMonths: string;
  dobFrom: string;
  dobTo: string;
  tagColors: string[];
  sort: string;
};

const CAMP_ANIMAL_FILTERS_DEFAULT: CampAnimalFilters = {
  search: "",
  sex: "all",
  breeds: [],
  owners: [],
  status: "ACTIVE",
  herdPlan: "all",
  castrated: "all",
  pregnant: "all",
  ageGroup: "all",
  ageMinMonths: "",
  ageMaxMonths: "",
  dobFrom: "",
  dobTo: "",
  tagColors: [],
  sort: "eartag_asc",
};

const CAMP_ANIMAL_COLUMN_STORAGE_KEY = "manyika.campAnimals.columns";
const CAMP_ANIMALS_VIEW_KEY = "manyika.campAnimals.view";

type CampAnimalsViewMode = "table" | "photoList" | "photoGrid";

function migrateCampAnimalsView(stored: string | null): CampAnimalsViewMode {
  if (stored === "table" || stored === "photoList" || stored === "photoGrid") {
    return stored;
  }
  if (stored === "list") return "table";
  if (stored === "grid") return "photoGrid";
  return "table";
}

function campAnimalSexShort(sex: string) {
  if (sex === "MALE") return "M";
  if (sex === "FEMALE") return "F";
  return "?";
}

function formatCampAnimalAge(ageMonths: number | null | undefined) {
  if (ageMonths == null) return "—";
  return `${Math.floor(ageMonths / 12)}y ${ageMonths % 12}mo`;
}

type AgeMode =
  | "all"
  | "calf"
  | "yearling"
  | "adult"
  | "mature"
  | "months"
  | "born";

export default function CampDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageCamps") : false;
  const canAddNotes = role ? hasPermission(role, "addCampNotes") : false;
  const canRegister = role ? hasPermission(role, "createAnimal") : false;

  const [camp, setCamp] = useState<CampDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [campAnimals, setCampAnimals] = useState<CampAnimal[]>([]);
  const [animalsLoading, setAnimalsLoading] = useState(false);
  const [animalsSearch, setAnimalsSearch] = useState("");
  const [animalsFiltersOpen, setAnimalsFiltersOpen] = useState(false);
  const [animalsColumnsOpen, setAnimalsColumnsOpen] = useState(false);
  const [campAnimalsView, setCampAnimalsView] =
    useState<CampAnimalsViewMode>("table");
  const [animalColumns, setAnimalColumns] = useState<AnimalColumnId[]>(() =>
    loadColumnPrefs(CAMP_ANIMAL_COLUMN_STORAGE_KEY, "bulkSale")
  );
  const [animalFilters, setAnimalFilters] = useState<CampAnimalFilters>(
    CAMP_ANIMAL_FILTERS_DEFAULT
  );
  const [ageFilterMode, setAgeFilterMode] = useState<AgeMode>("all");
  const [breeds, setBreeds] = useState<string[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [yearColors, setYearColors] = useState<Record<string, string>>({});
  const [defaultTagColor, setDefaultTagColor] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showLifecycle, setShowLifecycle] = useState(false);
  const [trashConfirmName, setTrashConfirmName] = useState("");
  const [noteDate, setNoteDate] = useState(todayInputDate);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    code: string;
    sizeAcres: string;
    latitude: string;
    longitude: string;
    waterSources: string;
    notes: string;
    tagColor: string;
    boundary: CampBoundary | null;
  }>({
    name: "",
    code: "",
    sizeAcres: "",
    latitude: "",
    longitude: "",
    waterSources: "",
    notes: "",
    tagColor: "",
    boundary: null,
  });

  useEffect(() => {
    setCampAnimalsView(migrateCampAnimalsView(localStorage.getItem(CAMP_ANIMALS_VIEW_KEY)));
  }, []);

  function setCampAnimalsViewMode(mode: CampAnimalsViewMode) {
    setCampAnimalsView(mode);
    localStorage.setItem(CAMP_ANIMALS_VIEW_KEY, mode);
  }

  const campAnimalsPhotoMode =
    campAnimalsView === "photoList" || campAnimalsView === "photoGrid";

  const loadCampAnimals = useCallback(async () => {
    setAnimalsLoading(true);
    const params = new URLSearchParams({
      camp: id,
      limit: "5000",
      sort: animalFilters.sort,
    });
    if (animalFilters.search.trim()) params.set("search", animalFilters.search.trim());
    if (animalFilters.sex !== "all") params.set("sex", animalFilters.sex);
    const breedParam = joinMultiParam(animalFilters.breeds);
    if (breedParam) params.set("breed", breedParam);
    const ownerParam = joinMultiParam(animalFilters.owners);
    if (ownerParam) params.set("owner", ownerParam);
    if (animalFilters.status !== "all") params.set("status", animalFilters.status);
    if (animalFilters.herdPlan !== "all") params.set("herdPlan", animalFilters.herdPlan);
    if (animalFilters.castrated !== "all") {
      params.set("castrated", animalFilters.castrated);
    }
    if (animalFilters.pregnant !== "all") {
      params.set("pregnant", animalFilters.pregnant);
    }
    if (animalFilters.ageGroup !== "all") {
      params.set("ageGroup", animalFilters.ageGroup);
    }
    if (animalFilters.ageMinMonths) {
      params.set("ageMinMonths", animalFilters.ageMinMonths);
    }
    if (animalFilters.ageMaxMonths) {
      params.set("ageMaxMonths", animalFilters.ageMaxMonths);
    }
    if (animalFilters.dobFrom) params.set("dobFrom", animalFilters.dobFrom);
    if (animalFilters.dobTo) params.set("dobTo", animalFilters.dobTo);
    const tagParam = joinMultiParam(animalFilters.tagColors);
    if (tagParam) params.set("tagColor", tagParam);

    try {
      const res = await fetch(`/api/animals?${params}`);
      const data = res.ok ? await res.json() : null;
      let animals = parseAnimalsList<CampAnimal>(data);
      if (animalFilters.tagColors.length > 0) {
        const allowed = new Set(animalFilters.tagColors);
        animals = animals.filter((a) => {
          const resolved = resolveTagColor({
            animalTagColor: a.tagColor,
            campTagColor: a.camp?.tagColor ?? camp?.tagColor ?? null,
            defaultTagColor,
            dob: a.dateOfBirth ?? a.dob,
            ageMonths: a.ageMonths,
            yearColors,
          }).color;
          return resolved != null && allowed.has(resolved);
        });
      }
      setCampAnimals(animals);
    } finally {
      setAnimalsLoading(false);
    }
  }, [animalFilters, camp?.tagColor, defaultTagColor, id, yearColors]);

  function applyAgeFilterMode(mode: AgeMode) {
    setAgeFilterMode(mode);
    setAnimalFilters((prev) => {
      const next: CampAnimalFilters = {
        ...prev,
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
      return next;
    });
  }

  function updateAnimalFilter<K extends keyof CampAnimalFilters>(
    key: K,
    value: CampAnimalFilters[K]
  ) {
    setAnimalFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "ageMinMonths" || key === "ageMaxMonths") {
        next.ageGroup = "all";
      }
      if (key === "dobFrom" || key === "dobTo") {
        next.ageGroup = "all";
        next.ageMinMonths = "";
        next.ageMaxMonths = "";
      }
      return next;
    });
    if (key === "ageMinMonths" || key === "ageMaxMonths") {
      setAgeFilterMode("months");
    }
    if (key === "dobFrom" || key === "dobTo") {
      setAgeFilterMode("born");
    }
  }

  function clearCampAnimalFilters() {
    setAnimalsSearch("");
    setAnimalFilters(CAMP_ANIMAL_FILTERS_DEFAULT);
    setAgeFilterMode("all");
  }

  const load = useCallback(
    async () => {
      setLoading(true);
      const res = await fetch(`/api/camps/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCamp(data);
        setForm({
          name: data.name || "",
          code: data.code || "",
          sizeAcres: data.sizeAcres != null ? String(data.sizeAcres) : "",
          latitude: data.latitude != null ? String(data.latitude) : "",
          longitude: data.longitude != null ? String(data.longitude) : "",
          waterSources: data.waterSources || "",
          notes: data.notes || "",
          tagColor: data.tagColor || "",
          boundary: parseBoundary(data.boundary),
        });
      }
      setLoading(false);
    },
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAnimalFilters((prev) =>
        prev.search === animalsSearch ? prev : { ...prev, search: animalsSearch }
      );
    }, 200);
    return () => window.clearTimeout(timer);
  }, [animalsSearch]);

  useEffect(() => {
    if (!camp) return;
    loadCampAnimals();
  }, [camp, loadCampAnimals]);

  async function saveDetails() {
    setSaving(true);
    const res = await fetch(`/api/camps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        code: form.code.trim() || null,
        sizeAcres: form.sizeAcres || null,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
        boundary: parseBoundary(form.boundary),
        waterSources: form.waterSources || null,
        notes: form.notes || null,
        tagColor: form.tagColor || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToSave"));
      return;
    }
    setEditing(false);
    await load();
    await loadCampAnimals();
  }

  async function addCampNote() {
    const text = noteBody.trim();
    if (!text) return;
    setSavingNote(true);
    const res = await fetch(`/api/camps/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, noteDate }),
    });
    setSavingNote(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToSave"));
      return;
    }
    const created = (await res.json()) as CampJournalNote;
    setNoteBody("");
    setNoteDate(todayInputDate());
    setCamp((c) =>
      c
        ? {
            ...c,
            journalNotes: [created, ...(c.journalNotes || [])],
          }
        : c
    );
  }

  async function toggleActive() {
    const next = !(camp?.isActive !== false);
    if (!next && !window.confirm(t("confirmDeactivateCamp"))) return;
    setSaving(true);
    const res = await fetch(`/api/camps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToSave"));
      return;
    }
    await load();
    await loadCampAnimals();
  }

  async function softDeleteCamp() {
    if (!camp) return;
    if (trashConfirmName.trim() !== camp.name.trim()) {
      alert(t("typeCampNameMismatch"));
      return;
    }
    if (!window.confirm(t("confirmSoftDeleteCamp"))) return;
    setSaving(true);
    const res = await fetch(`/api/camps/${id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToDelete"));
      return;
    }
    router.push("/camps");
  }

  if (loading) {
    return <p className="text-muted-foreground">{t("loading")}</p>;
  }
  if (!camp) {
    return <p className="text-muted-foreground">{t("noResults")}</p>;
  }

  const animalTotal =
    camp.animalTotal ?? camp._count?.animals ?? camp.animals.length;
  const bySex = camp.bySex ?? {};
  const sexLine = [
    bySex.MALE ? `${bySex.MALE} ${t("male")}` : null,
    bySex.FEMALE ? `${bySex.FEMALE} ${t("female")}` : null,
    bySex.UNKNOWN ? `${bySex.UNKNOWN} ${t("unknownSex")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const hasLegacyNotes = Boolean(camp.notes?.trim());
  const journalNotes = camp.journalNotes || [];
  const hasJournalNotes = journalNotes.length > 0;
  const notesSummary = hasJournalNotes
    ? t("campNoteCount", { n: journalNotes.length })
    : hasLegacyNotes
      ? t("legacyCampNotes")
      : t("noCampNotes");
  const locationSummary =
    camp.latitude != null && camp.longitude != null
      ? `${camp.latitude}, ${camp.longitude}`
      : t("noLocationSet");
  const campBoundary = parseBoundary(camp.boundary);
  const areaCount = boundaryAreaCount(campBoundary);
  const { acres: boundaryAcres } = boundaryTotalAcresUnion(campBoundary);
  const boundarySummary = campBoundary
    ? t("campBoundarySetAreas", {
        areas: areaCount,
        n: boundaryPointCount(campBoundary),
      }) +
      (boundaryAcres != null
        ? ` · ≈ ${formatAcresEstimate(boundaryAcres)} ${t("acres")}`
        : "")
    : t("campBoundaryNotSet");
  const photosSummary =
    (camp.photos?.length || 0) > 0
      ? t("photoCount", { n: camp.photos.length })
      : t("noCampPhotos");
  const registerHref = `/animals/new?camp=${camp.id}`;
  let campAnimalFilterCount = 0;
  if (animalFilters.sex !== "all") campAnimalFilterCount += 1;
  if (animalFilters.breeds.length > 0) campAnimalFilterCount += 1;
  if (animalFilters.owners.length > 0) campAnimalFilterCount += 1;
  if (animalFilters.status !== "all") campAnimalFilterCount += 1;
  if (animalFilters.herdPlan !== "all") campAnimalFilterCount += 1;
  if (animalFilters.castrated !== "all") campAnimalFilterCount += 1;
  if (animalFilters.pregnant !== "all") campAnimalFilterCount += 1;
  if (animalFilters.ageGroup !== "all") campAnimalFilterCount += 1;
  if (animalFilters.ageMinMonths || animalFilters.ageMaxMonths) {
    campAnimalFilterCount += 1;
  }
  if (animalFilters.dobFrom || animalFilters.dobTo) campAnimalFilterCount += 1;
  if (animalFilters.tagColors.length > 0) campAnimalFilterCount += 1;
  const campAnimalColumnsVisible = (id: AnimalColumnId) =>
    animalColumns.includes(id);

  return (
    <div className="space-y-6">
      <Link
        href="/camps"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> {t("navCamps")}
      </Link>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("editDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("campName")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("campCode")}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="MR-01"
                className="font-mono"
              />
              <p className="text-sm text-muted-foreground">{t("campCodeHelp")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("sizeAcres")}</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={form.sizeAcres}
                onChange={(e) =>
                  setForm({ ...form, sizeAcres: e.target.value })
                }
              />
              {boundaryTotalAcresUnion(parseBoundary(form.boundary)).acres !=
                null && (
                <p className="text-xs text-muted-foreground">
                  {t("campBoundaryTotalAcres", {
                    acres: formatAcresEstimate(
                      boundaryTotalAcresUnion(parseBoundary(form.boundary))
                        .acres!
                    ),
                  })}
                </p>
              )}
            </div>
            <OptionalSection
              open={showLocation}
              onToggle={() => setShowLocation((v) => !v)}
              title={t("campMapTitle")}
              summary={
                form.latitude && form.longitude
                  ? `${form.latitude}, ${form.longitude}`
                  : t("optionalTapToAdd")
              }
            >
              <CampMapPanel
                latitude={form.latitude}
                longitude={form.longitude}
                onPinChange={({ latitude, longitude }) =>
                  setForm((prev) => ({ ...prev, latitude, longitude }))
                }
                boundary={form.boundary}
                onBoundaryChange={(boundary) =>
                  setForm((prev) => ({ ...prev, boundary }))
                }
                onApplyAcresEstimate={(acres) =>
                  setForm((prev) => ({
                    ...prev,
                    sizeAcres: formatAcresEstimate(acres),
                  }))
                }
                downloadName={form.name || camp.name || "camp-border"}
              />
            </OptionalSection>
            <div className="space-y-2">
              <Label>{t("waterSources")}</Label>
              <Input
                value={form.waterSources}
                onChange={(e) =>
                  setForm({ ...form, waterSources: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("tagColorCamp")}</Label>
              <Select
                value={form.tagColor || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, tagColor: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("tagColorUseDefault")}</SelectItem>
                  {TAG_COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {tagColorLabel(c, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{t("tagColorHelp")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("notes")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveDetails} disabled={saving}>
                {saving ? t("saving") : t("save")}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                {t("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-muted/60 via-background to-background">
            <div className="absolute inset-x-0 top-0 h-1 bg-foreground/10" />
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                  {camp.logoUrl ? (
                    <ZoomableCampImage
                      src={camp.logoUrl}
                      alt={camp.name}
                      downloadName={`${(camp.code || camp.name).replace(/[^\w.-]+/g, "-")}-logo`}
                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl shadow-sm"
                    />
                  ) : (
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border bg-muted/80 shrink-0 flex items-center justify-center text-lg font-semibold text-muted-foreground">
                      {(camp.code || camp.name).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 space-y-1">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight truncate">
                      {camp.name}
                    </h1>
                    {camp.code && (
                      <p className="text-base sm:text-lg font-mono text-muted-foreground tracking-wide">
                        {camp.code}
                      </p>
                    )}
                    {camp.isActive === false && (
                      <Badge variant="secondary">{t("campInactive")}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0 w-full sm:w-auto">
                  {canRegister && camp.isActive !== false && (
                    <Button
                      asChild
                      className="w-full sm:w-auto bg-foreground text-background hover:bg-foreground/90"
                    >
                      <Link href={registerHref}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t("registerAnimal")}
                      </Link>
                    </Button>
                  )}
                  {canManage && (
                    <Button variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      {t("editDetails")}
                    </Button>
                  )}
                  {canManage && camp.isActive === false && (
                    <Button
                      variant="outline"
                      disabled={saving}
                      onClick={toggleActive}
                    >
                      {t("activateCamp")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-lg font-semibold tabular-nums">
                  {animalTotal}{" "}
                  <span className="font-medium text-muted-foreground">
                    {t("activeAnimals").toLowerCase()}
                  </span>
                </p>
                {sexLine && (
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {sexLine}
                  </p>
                )}
              </div>

              {(camp.tagColor ||
                camp.sizeAcres != null ||
                boundaryAcres != null ||
                camp.waterSources ||
                camp.assignments.length > 0) && (
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 border-t pt-4 text-sm">
                  {camp.tagColor && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <dt className="text-muted-foreground">{t("tagColorCamp")}</dt>
                      <dd>
                        <TagColorSwatch
                          color={camp.tagColor}
                          locale={locale}
                        />
                      </dd>
                    </div>
                  )}
                  {(camp.sizeAcres != null || boundaryAcres != null) && (
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <dt className="text-muted-foreground">{t("sizeAcres")}</dt>
                      <dd className="font-medium">
                        {camp.sizeAcres != null
                          ? `${camp.sizeAcres} ${t("acres")}`
                          : t("campBoundaryAcresEstimate", {
                              acres: formatAcresEstimate(boundaryAcres!),
                            })}
                      </dd>
                    </div>
                  )}
                  {camp.waterSources && (
                    <div className="flex flex-wrap items-baseline gap-x-2 sm:col-span-2">
                      <dt className="shrink-0 text-muted-foreground">
                        {t("waterSources")}
                      </dt>
                      <dd className="font-medium">{camp.waterSources}</dd>
                    </div>
                  )}
                  {camp.assignments.length > 0 && (
                    <div className="flex flex-wrap items-baseline gap-x-2 sm:col-span-2">
                      <dt className="shrink-0 text-muted-foreground">
                        {t("supervisor")}
                      </dt>
                      <dd className="font-medium">
                        {camp.assignments.map((a) => a.user.name).join(", ")}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </section>

          <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden divide-y">
            <OptionalSection
              embedded
              open={showNotes}
              onToggle={() => setShowNotes((v) => !v)}
              title={t("campNotes")}
              summary={notesSummary}
            >
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">{t("campNotesHelp")}</p>

              {canAddNotes && (
                <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                    <div className="space-y-1.5">
                      <Label htmlFor="camp-note-date">{t("campNoteDate")}</Label>
                      <Input
                        id="camp-note-date"
                        type="date"
                        value={noteDate}
                        onChange={(e) => setNoteDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="camp-note-body">{t("campNoteBody")}</Label>
                      <Textarea
                        id="camp-note-body"
                        value={noteBody}
                        onChange={(e) => setNoteBody(e.target.value)}
                        placeholder={t("campNotePlaceholder")}
                        rows={3}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingNote || !noteBody.trim()}
                    onClick={addCampNote}
                  >
                    {savingNote ? t("saving") : t("addCampNote")}
                  </Button>
                </div>
              )}

              {hasJournalNotes ? (
                <ul className="space-y-3">
                  {journalNotes.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-md border bg-background/80 p-3 space-y-1"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatNoteDate(n.noteDate, locale)}
                        </span>
                        {n.author?.name && (
                          <span>
                            {t("campNoteAuthor", { name: n.author.name })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {n.body}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <StickyNote className="h-4 w-4 shrink-0" />
                  {canAddNotes ? t("noCampNotesEditHint") : t("noCampNotes")}
                </p>
              )}

              {hasLegacyNotes && (
                <div className="rounded-md border border-dashed p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("legacyCampNotes")}
                  </p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {camp.notes}
                  </p>
                </div>
              )}
            </div>
            </OptionalSection>

            <OptionalSection
              embedded
              open={showLocation}
              onToggle={() => setShowLocation((v) => !v)}
              title={t("campMapTitle")}
              summary={`${locationSummary} · ${boundarySummary}`}
            >
              <CampMapPanel
                latitude={
                  camp.latitude != null ? String(camp.latitude) : ""
                }
                longitude={
                  camp.longitude != null ? String(camp.longitude) : ""
                }
                onPinChange={() => {}}
                boundary={campBoundary}
                onBoundaryChange={() => {}}
                disabled
                downloadName={camp.name || "camp-border"}
              />
            </OptionalSection>

            <OptionalSection
              embedded
              open={showPhotos}
              onToggle={() => setShowPhotos((v) => !v)}
              title={t("campPhotos")}
              summary={photosSummary}
            >
              <CampPhotoGallery
                campId={camp.id}
                initialPhotos={camp.photos || []}
                logoUrl={camp.logoUrl}
                campLabel={camp.code || camp.name}
                canEdit={canManage}
                onPhotosChange={() => {
                  void load();
                  void loadCampAnimals();
                }}
                onLogoChange={(url) =>
                  setCamp((c) => (c ? { ...c, logoUrl: url } : c))
                }
              />
            </OptionalSection>
          </div>
        </>
      )}

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold">
            {t("animalsInCamp")}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              ({animalTotal})
            </span>
          </h2>
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
            <div className="flex flex-wrap gap-2">
              <div
                className="inline-flex h-10 items-center rounded-lg border border-muted-foreground/20 p-0.5 bg-muted/30"
                role="group"
                aria-label={t("campsViewMode")}
              >
                <button
                  type="button"
                  onClick={() => setCampAnimalsViewMode("table")}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                    campAnimalsView === "table"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={campAnimalsView === "table"}
                >
                  <List className="h-3.5 w-3.5" />
                  {t("campsViewList")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCampAnimalsViewMode(
                      campAnimalsPhotoMode ? campAnimalsView : "photoList"
                    )
                  }
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                    campAnimalsPhotoMode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={campAnimalsPhotoMode}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  {t("campsViewPhotos")}
                </button>
              </div>
              {campAnimalsPhotoMode && (
                <div
                  className="inline-flex h-10 items-center rounded-lg border border-muted-foreground/20 p-0.5 bg-muted/20"
                  role="group"
                  aria-label={t("campsViewPhotos")}
                >
                  <button
                    type="button"
                    onClick={() => setCampAnimalsViewMode("photoList")}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                      campAnimalsView === "photoList"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={campAnimalsView === "photoList"}
                  >
                    <List className="h-3.5 w-3.5" />
                    {t("campAnimalsPhotoList")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampAnimalsViewMode("photoGrid")}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                      campAnimalsView === "photoGrid"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={campAnimalsView === "photoGrid"}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {t("campAnimalsPhotoCards")}
                  </button>
                </div>
              )}
              {campAnimalsView === "table" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none h-10 rounded-lg"
                  onClick={() => setAnimalsColumnsOpen(true)}
                >
                  <Columns3 className="h-4 w-4 mr-1.5" />
                  {t("columnsCount", { n: animalColumns.length })}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1 sm:flex-none h-10 rounded-lg",
                  animalsFiltersOpen && "border-foreground/40 bg-muted/40"
                )}
                onClick={() => setAnimalsFiltersOpen((v) => !v)}
              >
                <Filter className="h-4 w-4 mr-1.5" />
                {t("filters")}
                {campAnimalFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5">
                    {campAnimalFilterCount}
                  </Badge>
                )}
              </Button>
            </div>
            {canRegister && (
              <Button
                asChild
                className="w-full sm:w-auto h-10 rounded-lg bg-foreground text-background hover:bg-foreground/90"
              >
                <Link href={registerHref}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("registerAnimal")}
                </Link>
              </Button>
            )}
          </div>
        </div>
        {animalTotal === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
            <p className="text-muted-foreground text-sm">{t("noAnimalsInCamp")}</p>
            {canRegister && (
              <Button asChild>
                <Link href={registerHref}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("registerAnimal")}
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder={t("searchEartagBreed")}
                  value={animalsSearch}
                  onChange={(e) => setAnimalsSearch(e.target.value)}
                />
              </div>

              {animalsFiltersOpen && (
                <div className="rounded-xl border border-border/80 bg-card shadow-sm p-5 space-y-6">
                  <p className="text-xs text-muted-foreground">{t("filterMultiHint")}</p>
                  <section className="space-y-2.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("eartagColor")}
                    </Label>
                    <TagColorFilter
                      value={animalFilters.tagColors}
                      onChange={(codes) =>
                        setAnimalFilters((prev) => ({
                          ...prev,
                          tagColors: codes,
                        }))
                      }
                      showHelp={false}
                    />
                  </section>

                  <section className="space-y-2.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("sex")}
                    </Label>
                    <ChoicePills
                      options={[
                        { value: "all", label: t("allSexes") },
                        { value: "MALE", label: t("male") },
                        { value: "FEMALE", label: t("female") },
                        { value: "UNKNOWN", label: t("unknownSex") },
                      ]}
                      value={animalFilters.sex}
                      onChange={(value) =>
                        setAnimalFilters((prev) => ({
                          ...prev,
                          sex: value,
                          castrated: value === "MALE" ? prev.castrated : "all",
                          pregnant: value === "FEMALE" ? prev.pregnant : "all",
                        }))
                      }
                    />
                  </section>

                  <section className="space-y-2.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("status")}
                    </Label>
                    <ChoicePills
                      options={[
                        { value: "all", label: t("allStatuses") },
                        { value: "ACTIVE", label: t("statusActive") },
                        { value: "QUARANTINE", label: t("quarantine") },
                        { value: "MISSING", label: t("statusMissing") },
                        { value: "SOLD", label: t("statusSold") },
                        { value: "DECEASED", label: t("statusDeceased") },
                      ]}
                      value={animalFilters.status}
                      onChange={(value) =>
                        setAnimalFilters((prev) => ({ ...prev, status: value }))
                      }
                    />
                  </section>

                  <section className="space-y-2.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("breed")}
                    </Label>
                    <MultiTogglePills
                      options={breeds.map((breed) => ({
                        value: breed,
                        label: breed,
                      }))}
                      value={animalFilters.breeds}
                      onChange={(codes) =>
                        setAnimalFilters((prev) => ({ ...prev, breeds: codes }))
                      }
                      allLabel={t("allBreeds")}
                    />
                  </section>

                  <section className="space-y-2.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("owner")}
                    </Label>
                    <MultiTogglePills
                      options={owners.map((owner) => ({
                        value: owner.id,
                        label: owner.name,
                      }))}
                      value={animalFilters.owners}
                      onChange={(codes) =>
                        setAnimalFilters((prev) => ({ ...prev, owners: codes }))
                      }
                      allLabel={t("allOwners")}
                    />
                  </section>

                  <section className="space-y-2.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("herdPlan")}
                    </Label>
                    <HerdPlanFilter
                      value={animalFilters.herdPlan}
                      onChange={(value) =>
                        setAnimalFilters((prev) => ({ ...prev, herdPlan: value }))
                      }
                      label={false}
                    />
                  </section>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <section className="space-y-2.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("castrated")}
                      </Label>
                      <ChoicePills
                        options={[
                          { value: "all", label: t("all") },
                          { value: "true", label: t("yes") },
                          { value: "false", label: t("intactMales") },
                        ]}
                        value={animalFilters.castrated}
                        onChange={(value) =>
                          setAnimalFilters((prev) => ({
                            ...prev,
                            castrated: value,
                            sex: value === "all" ? prev.sex : "MALE",
                          }))
                        }
                      />
                    </section>
                    <section className="space-y-2.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("pregnant")}
                      </Label>
                      <ChoicePills
                        options={[
                          { value: "all", label: t("all") },
                          { value: "true", label: t("yes") },
                          { value: "false", label: t("no") },
                        ]}
                        value={animalFilters.pregnant}
                        onChange={(value) =>
                          setAnimalFilters((prev) => ({
                            ...prev,
                            pregnant: value,
                            sex: value === "all" ? prev.sex : "FEMALE",
                          }))
                        }
                      />
                    </section>
                  </div>

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
                          <p className="text-xs text-muted-foreground">
                            {t("ageMinMonths")}
                          </p>
                          <Input
                            type="number"
                            min={0}
                            className="h-10 rounded-lg"
                            placeholder="0"
                            value={animalFilters.ageMinMonths}
                            onChange={(e) =>
                              updateAnimalFilter("ageMinMonths", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">
                            {t("ageMaxMonths")}
                          </p>
                          <Input
                            type="number"
                            min={0}
                            className="h-10 rounded-lg"
                            placeholder="24"
                            value={animalFilters.ageMaxMonths}
                            onChange={(e) =>
                              updateAnimalFilter("ageMaxMonths", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    )}
                    {ageFilterMode === "born" && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">
                            {t("bornFrom")}
                          </p>
                          <Input
                            type="date"
                            className="h-10 rounded-lg"
                            value={animalFilters.dobFrom}
                            onChange={(e) =>
                              updateAnimalFilter("dobFrom", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">
                            {t("bornTo")}
                          </p>
                          <Input
                            type="date"
                            className="h-10 rounded-lg"
                            value={animalFilters.dobTo}
                            onChange={(e) =>
                              updateAnimalFilter("dobTo", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="space-y-2.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("sortBy")}
                    </Label>
                    <Select
                      value={animalFilters.sort}
                      onValueChange={(value) =>
                        setAnimalFilters((prev) => ({ ...prev, sort: value }))
                      }
                    >
                      <SelectTrigger className="h-10 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eartag_asc">{t("eartag")} A-Z</SelectItem>
                        <SelectItem value="eartag_desc">{t("eartag")} Z-A</SelectItem>
                        <SelectItem value="breed_asc">{t("breed")} A-Z</SelectItem>
                        <SelectItem value="sex_asc">{t("sex")} A-Z</SelectItem>
                        <SelectItem value="age_desc">{t("age")} ↓</SelectItem>
                        <SelectItem value="age_asc">{t("age")} ↑</SelectItem>
                        <SelectItem value="newest">Newest</SelectItem>
                      </SelectContent>
                    </Select>
                  </section>

                  <div className="flex justify-between border-t pt-4">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground"
                      onClick={clearCampAnimalFilters}
                    >
                      {t("clearAll")}
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => setAnimalsFiltersOpen(false)}
                    >
                      {t("apply")}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border overflow-x-auto">
              {animalsLoading ? (
                <p className="p-4 text-sm text-muted-foreground">
                  {t("loadingAnimals")}
                </p>
              ) : campAnimals.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  {t("noAnimalsMatch")}
                </p>
              ) : campAnimalsView === "photoGrid" ? (
                <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {campAnimals.map((animal) => {
                    const lifecycle = lifecycleKind({
                      sex: animal.sex,
                      ageMonths: animal.ageMonths,
                      isCastrated: animal.isCastrated,
                    });
                    return (
                      <Link key={animal.id} href={`/animals/${animal.id}`}>
                        <Card className="overflow-hidden h-full border-muted-foreground/10 shadow-none hover:border-muted-foreground/25 transition-colors">
                          <div className="aspect-[4/3] bg-muted/50 flex items-center justify-center">
                            {animal.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={animal.photoUrl}
                                alt={animal.eartag}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-2xl font-semibold text-muted-foreground/50">
                                {campAnimalSexShort(animal.sex)}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5 p-3.5">
                            <EartagBadge
                              eartag={animal.eartag}
                              animalTagColor={animal.tagColor}
                              campTagColor={
                                animal.camp?.tagColor ?? camp.tagColor
                              }
                              defaultTagColor={defaultTagColor}
                              dob={animal.dateOfBirth ?? animal.dob}
                              ageMonths={animal.ageMonths}
                              yearColors={yearColors}
                              locale={locale}
                            />
                            <p className="text-sm text-muted-foreground truncate">
                              {animal.breed}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatCampAnimalAge(animal.ageMonths)}
                              {" · "}
                              {formatDate(animal.dateOfBirth ?? animal.dob)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t(lifecycleLabelKey(lifecycle))}
                            </p>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              ) : campAnimalsView === "photoList" ? (
                <div className="overflow-hidden">
                  <div className="hidden sm:grid grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem] gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/60 bg-muted/30">
                    <span />
                    <span>{t("eartag")}</span>
                    <span>{t("breed")}</span>
                    <span>{t("dob")}</span>
                    <span className="text-right">{t("age")}</span>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {campAnimals.map((animal) => {
                      const lifecycle = lifecycleKind({
                        sex: animal.sex,
                        ageMonths: animal.ageMonths,
                        isCastrated: animal.isCastrated,
                      });
                      return (
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
                                  {campAnimalSexShort(animal.sex)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <EartagBadge
                                  eartag={animal.eartag}
                                  animalTagColor={animal.tagColor}
                                  campTagColor={
                                    animal.camp?.tagColor ?? camp.tagColor
                                  }
                                  defaultTagColor={defaultTagColor}
                                  dob={animal.dateOfBirth ?? animal.dob}
                                  ageMonths={animal.ageMonths}
                                  yearColors={yearColors}
                                  locale={locale}
                                  className="group-hover:text-primary transition-colors"
                                />
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                                  {campAnimalSexShort(animal.sex)}
                                </span>
                                <Badge variant="outline" className="font-normal text-[10px] px-1.5 py-0 h-5">
                                  {t(lifecycleLabelKey(lifecycle))}
                                </Badge>
                              </div>
                              <p className="sm:hidden text-sm text-muted-foreground truncate mt-0.5">
                                {animal.breed}
                                {" · "}
                                {formatCampAnimalAge(animal.ageMonths)}
                                {" · "}
                                {formatDate(animal.dateOfBirth ?? animal.dob)}
                              </p>
                            </div>
                            <p className="hidden sm:block text-sm text-muted-foreground truncate">
                              {animal.breed}
                            </p>
                            <p className="hidden sm:block text-sm text-muted-foreground truncate">
                              {formatDate(animal.dateOfBirth ?? animal.dob)}
                            </p>
                            <p className="hidden sm:block text-sm text-muted-foreground text-right tabular-nums">
                              {formatCampAnimalAge(animal.ageMonths)}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {campAnimalColumnsVisible("eartag") && (
                      <th className="p-3 text-left">{t("eartag")}</th>
                    )}
                    {campAnimalColumnsVisible("breed") && (
                      <th className="p-3 text-left">{t("breed")}</th>
                    )}
                    {campAnimalColumnsVisible("sex") && (
                      <th className="p-3 text-left">{t("sex")}</th>
                    )}
                    {campAnimalColumnsVisible("type") && (
                      <th className="p-3 text-left">{t("lifecycleType")}</th>
                    )}
                    {campAnimalColumnsVisible("status") && (
                      <th className="p-3 text-left">{t("status")}</th>
                    )}
                    {campAnimalColumnsVisible("age") && (
                      <th className="p-3 text-left">{t("age")}</th>
                    )}
                    {campAnimalColumnsVisible("rfid") && (
                      <th className="p-3 text-left">{t("rfidChip")}</th>
                    )}
                    {campAnimalColumnsVisible("herdPlan") && (
                      <th className="p-3 text-left">{t("herdPlan")}</th>
                    )}
                    {campAnimalColumnsVisible("owner") && (
                      <th className="p-3 text-left">{t("owner")}</th>
                    )}
                    {campAnimalColumnsVisible("dob") && (
                      <th className="p-3 text-left">{t("dob")}</th>
                    )}
                    {campAnimalColumnsVisible("castrated") && (
                      <th className="p-3 text-left">{t("castrated")}</th>
                    )}
                    {campAnimalColumnsVisible("pregnant") && (
                      <th className="p-3 text-left">{t("pregnant")}</th>
                    )}
                    {campAnimalColumnsVisible("sire") && (
                      <th className="p-3 text-left">{t("sire")}</th>
                    )}
                    {campAnimalColumnsVisible("dam") && (
                      <th className="p-3 text-left">{t("dam")}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {campAnimals.map((animal) => {
                      const lifecycle = lifecycleKind({
                        sex: animal.sex,
                        ageMonths: animal.ageMonths,
                        isCastrated: animal.isCastrated,
                      });
                      return (
                        <tr key={animal.id} className="border-b hover:bg-muted/30">
                          {campAnimalColumnsVisible("eartag") && (
                            <td className="p-3">
                              <Link
                                href={`/animals/${animal.id}`}
                                className="text-primary hover:underline font-medium"
                              >
                                <EartagBadge
                                  eartag={animal.eartag}
                                  animalTagColor={animal.tagColor}
                                  campTagColor={animal.camp?.tagColor ?? camp.tagColor}
                                  defaultTagColor={defaultTagColor}
                                  dob={animal.dateOfBirth ?? animal.dob}
                                  ageMonths={animal.ageMonths}
                                  yearColors={yearColors}
                                  locale={locale}
                                />
                              </Link>
                            </td>
                          )}
                          {campAnimalColumnsVisible("breed") && (
                            <td className="p-3">{animal.breed}</td>
                          )}
                          {campAnimalColumnsVisible("sex") && (
                            <td className="p-3">
                              <Badge variant="secondary">
                                {animal.sex === "MALE"
                                  ? t("male")
                                  : animal.sex === "FEMALE"
                                    ? t("female")
                                    : t("unknownSex")}
                              </Badge>
                            </td>
                          )}
                          {campAnimalColumnsVisible("type") && (
                            <td className="p-3 text-muted-foreground">
                              {t(lifecycleLabelKey(lifecycle))}
                            </td>
                          )}
                          {campAnimalColumnsVisible("status") && (
                            <td className="p-3">
                              <Badge variant="outline">
                                {animal.status === "ACTIVE"
                                  ? t("statusActive")
                                  : animal.status === "QUARANTINE"
                                    ? t("quarantine")
                                    : animal.status === "MISSING"
                                      ? t("statusMissing")
                                      : animal.status === "SOLD"
                                        ? t("statusSold")
                                        : t("statusDeceased")}
                              </Badge>
                            </td>
                          )}
                          {campAnimalColumnsVisible("age") && (
                            <td className="p-3">
                              {formatCampAnimalAge(animal.ageMonths)}
                            </td>
                          )}
                          {campAnimalColumnsVisible("rfid") && (
                            <td className="p-3 font-mono text-xs">
                              {animal.rfidChip || "—"}
                            </td>
                          )}
                          {campAnimalColumnsVisible("herdPlan") && (
                            <td className="p-3">
                              {animal.herdPlan && animal.herdPlan !== "EXCLUDED" ? (
                                <Badge variant={herdPlanBadgeVariant(animal.herdPlan)}>
                                  {t(herdPlanLabelKey(animal.herdPlan))}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </td>
                          )}
                          {campAnimalColumnsVisible("owner") && (
                            <td className="p-3">{animal.owner?.name || "—"}</td>
                          )}
                          {campAnimalColumnsVisible("dob") && (
                            <td className="p-3">
                              {formatDate(animal.dateOfBirth ?? animal.dob)}
                            </td>
                          )}
                          {campAnimalColumnsVisible("castrated") && (
                            <td className="p-3">
                              {animal.sex === "MALE"
                                ? animal.isCastrated
                                  ? t("yes")
                                  : t("no")
                                : "—"}
                            </td>
                          )}
                          {campAnimalColumnsVisible("pregnant") && (
                            <td className="p-3">
                              {animal.sex === "FEMALE"
                                ? animal.isPregnant
                                  ? t("yes")
                                  : t("no")
                                : "—"}
                            </td>
                          )}
                          {campAnimalColumnsVisible("sire") && (
                            <td className="p-3">{animal.sire?.eartag || "—"}</td>
                          )}
                          {campAnimalColumnsVisible("dam") && (
                            <td className="p-3">{animal.dam?.eartag || "—"}</td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              )}
            </div>
            </div>
          </>
        )}
      </div>

      {canManage && !editing && (
        <OptionalSection
          open={showLifecycle}
          onToggle={() => {
            setShowLifecycle((v) => !v);
            if (showLifecycle) setTrashConfirmName("");
          }}
          title={t("campLifecycleTitle")}
          summary={t("campLifecycleSummary")}
          className="border-dashed border-muted-foreground/30 bg-muted/20"
        >
          <p className="text-sm text-muted-foreground">
            {t("campLifecycleHelp")}
          </p>

          <div className="rounded-md border bg-background/80 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{t("campStatus")}</p>
                <p className="text-xs text-muted-foreground">
                  {camp.isActive === false
                    ? t("campInactive")
                    : t("campActive")}
                  {" · "}
                  {t("deactivateCampHelp")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={toggleActive}
              >
                {camp.isActive === false
                  ? t("activateCamp")
                  : t("deactivateCamp")}
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-3">
            <div>
              <p className="text-sm font-medium text-destructive">
                {t("moveToTrash")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("softDeleteCampHelp")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trash-confirm">
                {t("typeCampNameToConfirm", { name: camp.name })}
              </Label>
              <Input
                id="trash-confirm"
                value={trashConfirmName}
                onChange={(e) => setTrashConfirmName(e.target.value)}
                placeholder={camp.name}
                autoComplete="off"
                className="max-w-sm"
              />
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={
                saving || trashConfirmName.trim() !== camp.name.trim()
              }
              onClick={softDeleteCamp}
            >
              {t("moveToTrash")}
            </Button>
          </div>
        </OptionalSection>
      )}

      <CustomizeColumnsPanel
        open={animalsColumnsOpen}
        onClose={() => setAnimalsColumnsOpen(false)}
        storageKey={CAMP_ANIMAL_COLUMN_STORAGE_KEY}
        value={animalColumns}
        onChange={setAnimalColumns}
        variant="bulkSale"
      />
    </div>
  );
}
