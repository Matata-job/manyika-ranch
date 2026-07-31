"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatCurrency } from "@/lib/utils";
import { formatAge, type AgeDisplayMode } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PedigreeTree, OffspringTree } from "@/components/pedigree-tree";
import { AnimalPhotoGallery, type AnimalPhoto } from "@/components/animal-photo-gallery";
import { ArrowLeft, Pencil, StickyNote, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { useLocale, useT } from "@/components/providers/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { EartagBadge, TagColorSwatch } from "@/components/eartag-badge";
import { TAG_COLORS, resolveTagColor, tagColorLabel } from "@/lib/tag-color";
import { parseAnimalsList } from "@/lib/animals-api";
import { PhotoSourcePicker } from "@/components/photo-source-picker";
import { useObjectUrls } from "@/hooks/use-object-urls";

interface AnimalEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  occurredAt: string;
  recordedBy: { name: string } | null;
}

interface DeathRecord {
  id: string;
  date: string;
  cause: string;
  causeDetail: string | null;
  disposalMethod: string;
  disposalNotes: string | null;
  location: string | null;
  weightKg: number | null;
  photoUrl: string | null;
  insuranceClaim: boolean;
  claimAmountTzs: number | null;
  claimReference: string | null;
  isCulling: boolean;
  notes: string | null;
  recordedBy: { name: string };
}

interface SaleRecord {
  id: string;
  buyer: string;
  priceTzs: number;
  weightAtSale: number | null;
  saleDate: string;
  transport: string | null;
  notes: string | null;
}

interface AnimalDetail {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  isCastrated?: boolean;
  isPregnant?: boolean;
  dob: string | null;
  ageMonths: number | null;
  status: string;
  photoUrl: string | null;
  colorMarkings: string | null;
  tagColor: string | null;
  notes: string | null;
  acquisitionType?: string | null;
  acquisitionDate?: string | null;
  camp: { id: string; name: string; tagColor?: string | null; code?: string | null };
  owner: { id: string; name: string };
  sire: { id: string; eartag: string } | null;
  dam: { id: string; eartag: string } | null;
  weightLogs: { id: string; date: string; weightKg: number; recordedBy: { name: string } }[];
  healthRecords: { id: string; date: string; type: string; diagnosis: string | null; treatment: string | null }[];
  vaccinations: { id: string; date: string; vaccineName: string; nextDue: string | null; batchNo: string | null }[];
  treatments: {
    id: string;
    date: string;
    type: string;
    product: string;
    dose: string | null;
    nextDue?: string | null;
    withdrawalPeriod?: number | null;
  }[];
  movements: { id: string; date: string; fromCamp: { name: string }; toCamp: { name: string }; authorizedBy: { name: string } }[];
  events: AnimalEvent[];
  deathRecord: DeathRecord | null;
  sales: SaleRecord[];
  photos: AnimalPhoto[];
}

const DEATH_CAUSES = [
  "DISEASE",
  "INJURY",
  "PREDATION",
  "DROUGHT_STARVATION",
  "BIRTHING",
  "OLD_AGE",
  "CULLING",
  "UNKNOWN",
  "OTHER",
];

const DISPOSAL_METHODS = ["BURIED", "BURNED", "SOLD_CARCASS", "REMOVED", "OTHER"];

function deathCauseKey(cause: string): TranslationKey {
  switch (cause) {
    case "DISEASE":
      return "illness";
    case "INJURY":
      return "injury";
    case "PREDATION":
      return "causePredation";
    case "DROUGHT_STARVATION":
      return "causeDroughtStarvation";
    case "BIRTHING":
      return "causeBirthing";
    case "OLD_AGE":
      return "causeOldAge";
    case "CULLING":
      return "causeCulling";
    case "UNKNOWN":
      return "causeUnknown";
    default:
      return "other";
  }
}

function disposalMethodKey(method: string): TranslationKey {
  switch (method) {
    case "BURIED":
      return "disposalBuried";
    case "BURNED":
      return "disposalBurned";
    case "SOLD_CARCASS":
      return "disposalSoldCarcass";
    case "REMOVED":
      return "disposalRemoved";
    default:
      return "other";
  }
}

function treatmentTypeKey(type: string): TranslationKey {
  switch (type) {
    case "DEWORMING":
      return "deworming";
    case "DIPPING":
      return "dipping";
    case "ANTIBIOTIC":
      return "antibiotic";
    default:
      return "other";
  }
}

function healthTypeKey(type: string): TranslationKey {
  switch (type) {
    case "CHECKUP":
      return "checkup";
    case "ILLNESS":
      return "illness";
    case "INJURY":
      return "injury";
    default:
      return "other";
  }
}

export default function AnimalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { locale } = useLocale();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canEdit = role ? hasPermission(role, "editAnimal") : false;
  const canUpdateRecords = role
    ? hasPermission(role, "updateAnimalRecords")
    : false;
  const canRecordDeath = role ? hasPermission(role, "manageMortality") : false;
  const canEditDeath = role ? hasPermission(role, "editMortality") : false;
  const canMove = role ? hasPermission(role, "manageMovements") : false;
  const canManageHealth = role ? hasPermission(role, "manageHealth") : false;
  const canManageEvents = role ? hasPermission(role, "manageEvents") : false;
  const canSell = role ? hasPermission(role, "manageSales") : false;
  const [animal, setAnimal] = useState<AnimalDetail | null>(null);
  const [ageMode, setAgeMode] = useState<AgeDisplayMode>("AUTO");
  const [yearColors, setYearColors] = useState<Record<string, string>>({});
  const [defaultTagColor, setDefaultTagColor] = useState<string | null>(null);
  const [quickNote, setQuickNote] = useState("");
  const [savingQuickNote, setSavingQuickNote] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [pedigree, setPedigree] = useState<{
    offspring?: {
      id: string;
      eartag: string;
      breed: string;
      sex: string;
      dob?: string | null;
      offspring?: unknown[];
    }[];
    offspringCount?: number;
    [key: string]: unknown;
  } | null>(null);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [breeds, setBreeds] = useState<{ id: string; name: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [parentAnimals, setParentAnimals] = useState<
    { id: string; eartag: string; sex: string; campId: string; campName: string }[]
  >([]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [editForm, setEditForm] = useState({
    eartag: "",
    breed: "",
    sex: "FEMALE",
    dob: "",
    ageYears: "",
    ageMonthsPart: "",
    campId: "",
    ownerId: "",
    status: "ACTIVE",
    acquisitionType: "BORN_ON_FARM",
    acquisitionDate: "",
    colorMarkings: "",
    tagColor: "",
    notes: "",
    sireId: "",
    damId: "",
  });
  const [weightKg, setWeightKg] = useState("");
  const [moveCampId, setMoveCampId] = useState("");
  const [healthForm, setHealthForm] = useState({ type: "CHECKUP", diagnosis: "", treatment: "" });
  const [vaccForm, setVaccForm] = useState({
    vaccineCatalogId: "",
    vaccineName: "",
    batchNo: "",
    nextDue: "",
  });
  const [vaccineOptions, setVaccineOptions] = useState<
    { id: string; name: string; intervalDays: number | null }[]
  >([]);
  const [treatForm, setTreatForm] = useState({
    treatmentCatalogId: "",
    type: "DIPPING",
    product: "",
    dose: "",
    withdrawalPeriod: "",
    nextDue: "",
  });
  const [treatmentOptions, setTreatmentOptions] = useState<
    {
      id: string;
      name: string;
      type: string;
      intervalDays: number | null;
      withdrawalPeriod: number | null;
    }[]
  >([]);
  const [eventForm, setEventForm] = useState({ type: "NOTE", title: "", description: "", occurredAt: "" });
  const [deathForm, setDeathForm] = useState({
    date: "",
    cause: "UNKNOWN",
    causeDetail: "",
    disposalMethod: "BURIED",
    disposalNotes: "",
    location: "",
    weightKg: "",
    insuranceClaim: false,
    claimAmountTzs: "",
    claimReference: "",
    isCulling: false,
    notes: "",
  });
  const [deathPhotoFile, setDeathPhotoFile] = useState<File | null>(null);
  const deathPhotoPreview = useObjectUrls(deathPhotoFile ? [deathPhotoFile] : []);
  const [editingDeath, setEditingDeath] = useState(false);
  const [savingDeath, setSavingDeath] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [saleForm, setSaleForm] = useState({
    buyerId: "",
    buyer: "",
    createBuyer: true,
    priceTzs: "",
    weightAtSale: "",
    saleDate: "",
    transport: "",
    notes: "",
  });
  const [buyerOptions, setBuyerOptions] = useState<
    { id: string; name: string; phone: string | null; location: string | null }[]
  >([]);
  const [buyerSearch, setBuyerSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadAnimal() {
    const res = await fetch(`/api/animals/${id}`);
    if (res.ok) setAnimal(await res.json());
  }

  useEffect(() => {
    loadAnimal();
    fetch(`/api/animals/${id}/pedigree`).then((r) => (r.ok ? r.json() : null)).then(setPedigree);
    fetch(`/api/camps?for=movement`).then((r) => r.json()).then(setCamps);
    fetch("/api/breeds")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBreeds(Array.isArray(d) ? d : []));
    fetch("/api/owners")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setOwners(Array.isArray(d) ? d : []));
    fetch("/api/ranch/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ageDisplayMode) setAgeMode(data.ageDisplayMode);
        if (data?.eartagYearColors) setYearColors(data.eartagYearColors);
        setDefaultTagColor(data?.defaultTagColor || null);
      });
    fetch("/api/buyers")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBuyerOptions(Array.isArray(d) ? d : []));
    fetch("/api/health/vaccines")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setVaccineOptions(Array.isArray(d) ? d : []));
    fetch("/api/health/treatment-schedules")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTreatmentOptions(Array.isArray(d) ? d : []));
    fetch("/api/animals?status=ACTIVE&limit=5000")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setParentAnimals(
          parseAnimalsList<{
            id: string;
            eartag: string;
            sex: string;
            camp?: { id: string; name: string };
          }>(data)
            .filter((a) => a.id !== id)
            .map((a) => ({
              id: a.id,
              eartag: a.eartag,
              sex: a.sex,
              campId: a.camp?.id || "",
              campName: a.camp?.name || "",
            }))
        );
      });
  }, [id]);

  async function searchBuyers(q: string) {
    setBuyerSearch(q);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/buyers?${params}`);
    if (res.ok) setBuyerOptions(await res.json());
  }

  function startEditDetails(a: AnimalDetail) {
    const years = a.ageMonths != null ? Math.floor(a.ageMonths / 12) : "";
    const months = a.ageMonths != null ? a.ageMonths % 12 : "";
    setEditForm({
      eartag: a.eartag,
      breed: a.breed,
      sex: a.sex,
      dob: a.dob ? a.dob.slice(0, 10) : "",
      ageYears: years === "" ? "" : String(years),
      ageMonthsPart: months === "" ? "" : String(months),
      campId: a.camp.id,
      ownerId: a.owner.id,
      status: a.status,
      acquisitionType: a.acquisitionType || "BORN_ON_FARM",
      acquisitionDate: a.acquisitionDate ? a.acquisitionDate.slice(0, 10) : "",
      colorMarkings: a.colorMarkings || "",
      tagColor: a.tagColor || "",
      notes: a.notes || "",
      sireId: a.sire?.id || "",
      damId: a.dam?.id || "",
    });
    setEditingDetails(true);
  }

  async function saveDetails() {
    if (!editForm.eartag.trim() || !editForm.breed) {
      alert(t("eartagBreedRequired"));
      return;
    }
    setSavingDetails(true);
    const payload: Record<string, unknown> = {
      eartag: editForm.eartag.trim(),
      breed: editForm.breed,
      sex: editForm.sex,
      campId: editForm.campId,
      ownerId: editForm.ownerId,
      colorMarkings: editForm.colorMarkings || null,
      tagColor: editForm.tagColor || null,
      notes: editForm.notes || null,
      sireId: editForm.sireId || null,
      damId: editForm.damId || null,
      acquisitionType: editForm.acquisitionType,
      acquisitionDate: editForm.acquisitionDate || null,
    };
    if (editForm.dob) {
      payload.dob = editForm.dob;
    } else {
      payload.dob = null;
      payload.ageYears = editForm.ageYears || 0;
      payload.ageMonthsPart = editForm.ageMonthsPart || 0;
    }
    if (!["SOLD", "DECEASED"].includes(animal?.status || "")) {
      payload.status = editForm.status;
    }

    const res = await fetch(`/api/animals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingDetails(false);
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || t("failedToSave"));
      return;
    }
    setEditingDetails(false);
    loadAnimal();
  }

  async function deleteSubRecord(
    kind: "weights" | "health" | "vaccinations" | "treatments",
    recordId: string
  ) {
    if (!confirm(t("confirmDelete"))) return;
    const pathMap = {
      weights: `weights/${recordId}`,
      health: `health/${recordId}`,
      vaccinations: `vaccinations/${recordId}`,
      treatments: `treatments/${recordId}`,
    };
    setDeletingId(recordId);
    const res = await fetch(`/api/animals/${id}/${pathMap[kind]}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToDelete"));
      return;
    }
    loadAnimal();
  }

  async function toggleSexStatus(field: "isCastrated" | "isPregnant", value: boolean) {
    setStatusSaving(true);
    await fetch(`/api/animals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value, sex: animal?.sex }),
    });
    setStatusSaving(false);
    loadAnimal();
  }

  async function addWeight() {
    if (!weightKg) return;
    await fetch(`/api/animals/${id}/weights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weightKg: parseFloat(weightKg) }),
    });
    setWeightKg("");
    loadAnimal();
  }

  async function addHealth() {
    await fetch(`/api/animals/${id}/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(healthForm),
    });
    setHealthForm({ type: "CHECKUP", diagnosis: "", treatment: "" });
    loadAnimal();
  }

  async function addVaccination() {
    if (!vaccForm.vaccineName.trim() && !vaccForm.vaccineCatalogId) {
      alert(t("selectVaccineOrName"));
      return;
    }
    await fetch(`/api/animals/${id}/vaccinations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vaccineCatalogId: vaccForm.vaccineCatalogId || null,
        vaccineName: vaccForm.vaccineName,
        batchNo: vaccForm.batchNo || null,
        nextDue: vaccForm.nextDue || null,
      }),
    });
    setVaccForm({ vaccineCatalogId: "", vaccineName: "", batchNo: "", nextDue: "" });
    loadAnimal();
  }

  function onVaccineCatalogChange(catalogId: string) {
    if (catalogId === "__custom__") {
      setVaccForm({ ...vaccForm, vaccineCatalogId: "", vaccineName: "" });
      return;
    }
    const v = vaccineOptions.find((x) => x.id === catalogId);
    setVaccForm({
      ...vaccForm,
      vaccineCatalogId: catalogId,
      vaccineName: v?.name || "",
      nextDue: "",
    });
  }

  async function addTreatment() {
    if (!treatForm.product.trim() && !treatForm.treatmentCatalogId) {
      alert(t("selectScheduleOrProduct"));
      return;
    }
    await fetch(`/api/animals/${id}/treatments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        treatmentCatalogId: treatForm.treatmentCatalogId || null,
        type: treatForm.type,
        product: treatForm.product,
        dose: treatForm.dose || null,
        withdrawalPeriod: treatForm.withdrawalPeriod || null,
        nextDue: treatForm.nextDue || null,
      }),
    });
    setTreatForm({
      treatmentCatalogId: "",
      type: "DIPPING",
      product: "",
      dose: "",
      withdrawalPeriod: "",
      nextDue: "",
    });
    loadAnimal();
  }

  function onTreatmentCatalogChange(catalogId: string) {
    if (catalogId === "__custom__") {
      setTreatForm({
        ...treatForm,
        treatmentCatalogId: "",
        product: "",
      });
      return;
    }
    const schedule = treatmentOptions.find((x) => x.id === catalogId);
    setTreatForm({
      ...treatForm,
      treatmentCatalogId: catalogId,
      type: schedule?.type || treatForm.type,
      product: schedule?.name || "",
      withdrawalPeriod:
        schedule?.withdrawalPeriod != null
          ? String(schedule.withdrawalPeriod)
          : treatForm.withdrawalPeriod,
      nextDue: "",
    });
  }

  async function moveAnimal() {
    if (!moveCampId) return;
    await fetch(`/api/animals/${id}/movements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toCampId: moveCampId, reason: "Camp transfer" }),
    });
    setMoveCampId("");
    loadAnimal();
  }

  async function addEvent() {
    if (!eventForm.title.trim()) return;
    await fetch(`/api/animals/${id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...eventForm,
        occurredAt: eventForm.occurredAt || undefined,
      }),
    });
    setEventForm({ type: "NOTE", title: "", description: "", occurredAt: "" });
    loadAnimal();
  }

  async function addQuickNote() {
    const text = quickNote.trim();
    if (!text) return;
    setSavingQuickNote(true);
    const title = text.length > 80 ? `${text.slice(0, 77)}…` : text;
    await fetch(`/api/animals/${id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "NOTE",
        title,
        description: text.length > 80 ? text : undefined,
      }),
    });
    setQuickNote("");
    setSavingQuickNote(false);
    loadAnimal();
  }

  async function uploadDeathPhoto(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "animals");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || t("photoUploadFailed"));
    }
    const { url } = await res.json();
    return url as string;
  }

  function startEditDeath(record: DeathRecord) {
    setDeathForm({
      date: record.date ? record.date.slice(0, 10) : "",
      cause: record.cause || "UNKNOWN",
      causeDetail: record.causeDetail || "",
      disposalMethod: record.disposalMethod || "BURIED",
      disposalNotes: record.disposalNotes || "",
      location: record.location || "",
      weightKg: record.weightKg != null ? String(record.weightKg) : "",
      insuranceClaim: record.insuranceClaim,
      claimAmountTzs:
        record.claimAmountTzs != null ? String(record.claimAmountTzs) : "",
      claimReference: record.claimReference || "",
      isCulling: record.isCulling,
      notes: record.notes || "",
    });
    setDeathPhotoFile(null);
    setEditingDeath(true);
  }

  async function recordDeath() {
    if (!confirm(t("confirmMarkDeceased"))) return;
    setSavingDeath(true);
    try {
      const photoUrl = deathPhotoFile
        ? await uploadDeathPhoto(deathPhotoFile)
        : null;
      const res = await fetch(`/api/animals/${id}/death`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...deathForm,
          date: deathForm.date || undefined,
          weightKg: deathForm.weightKg || null,
          claimAmountTzs: deathForm.claimAmountTzs || null,
          isCulling: deathForm.isCulling || deathForm.cause === "CULLING",
          photoUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || t("failedToSave"));
        return;
      }
      setDeathPhotoFile(null);
      setEditingDeath(false);
      loadAnimal();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("photoUploadFailed"));
    } finally {
      setSavingDeath(false);
    }
  }

  async function saveDeathEdit() {
    if (!animal?.deathRecord) return;
    setSavingDeath(true);
    try {
      let photoUrl: string | undefined;
      if (deathPhotoFile) {
        photoUrl = await uploadDeathPhoto(deathPhotoFile);
      }
      const res = await fetch(`/api/animals/${id}/death`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...deathForm,
          date: deathForm.date || undefined,
          weightKg: deathForm.weightKg || null,
          claimAmountTzs: deathForm.claimAmountTzs || null,
          isCulling: deathForm.isCulling || deathForm.cause === "CULLING",
          ...(photoUrl ? { photoUrl } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || t("failedToSave"));
        return;
      }
      setDeathPhotoFile(null);
      setEditingDeath(false);
      loadAnimal();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("photoUploadFailed"));
    } finally {
      setSavingDeath(false);
    }
  }

  async function recordSale() {
    if ((!saleForm.buyerId && !saleForm.buyer.trim()) || !saleForm.priceTzs) {
      alert(t("buyerPriceRequired"));
      return;
    }
    if (!confirm(t("confirmRecordSale"))) return;
    setSavingSale(true);
    const res = await fetch(`/api/animals/${id}/sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerId: saleForm.buyerId || null,
        buyer: saleForm.buyerId ? undefined : saleForm.buyer,
        createBuyer: !saleForm.buyerId && saleForm.createBuyer,
        priceTzs: saleForm.priceTzs,
        weightAtSale: saleForm.weightAtSale || null,
        saleDate: saleForm.saleDate || undefined,
        transport: saleForm.transport || null,
        notes: saleForm.notes || null,
      }),
    });
    setSavingSale(false);
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || t("failedToSave"));
      return;
    }
    setSaleForm({
      buyerId: "",
      buyer: "",
      createBuyer: true,
      priceTzs: "",
      weightAtSale: "",
      saleDate: "",
      transport: "",
      notes: "",
    });
    setBuyerSearch("");
    loadAnimal();
    fetch("/api/buyers")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBuyerOptions(Array.isArray(d) ? d : []));
  }

  if (!animal) {
    return <p className="text-muted-foreground">{t("loading")}</p>;
  }

  const isDeceased = animal.status === "DECEASED" || !!animal.deathRecord;
  const isSold = animal.status === "SOLD" || (animal.sales?.length ?? 0) > 0;
  const isClosed = isDeceased || isSold;
  const latestSale = animal.sales?.[0] ?? null;
  const weightChart = [...animal.weightLogs].reverse().map((w) => ({
    date: formatDate(w.date),
    weight: w.weightKg,
  }));

  return (
    <div className="space-y-6">
      <Link href="/animals" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> {t("backToAnimals")}
      </Link>

      <div className="flex flex-col md:flex-row gap-6">
        <AnimalPhotoGallery
          animalId={id}
          initialPhotos={animal.photos || []}
          coverUrl={animal.photoUrl}
          canEdit={
            (!isClosed && canUpdateRecords) || (isDeceased && canEdit)
          }
          onPhotosChange={loadAnimal}
        />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <EartagBadge
              eartag={animal.eartag}
              campTagColor={animal.camp.tagColor}
              animalTagColor={animal.tagColor}
              defaultTagColor={defaultTagColor}
              dob={animal.dob}
              ageMonths={animal.ageMonths}
              yearColors={yearColors}
              locale={locale}
              size="lg"
              showLabel
            />
            <Badge>
              {animal.sex === "MALE"
                ? t("male")
                : animal.sex === "FEMALE"
                  ? t("female")
                  : t("unknownSex")}
            </Badge>
            {animal.sex === "MALE" && animal.isCastrated && <Badge variant="outline">{t("castrated")}</Badge>}
            {animal.sex === "FEMALE" && animal.isPregnant && <Badge variant="warning">{t("pregnant")}</Badge>}
            <Badge variant={isDeceased ? "destructive" : isSold ? "warning" : "secondary"}>{animal.status}</Badge>
            {animal.deathRecord?.isCulling && <Badge variant="warning">{t("causeCulling")}</Badge>}
            {canEdit && !editingDetails && (
              <Button variant="outline" size="sm" onClick={() => startEditDetails(animal)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> {t("editDetails")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">{t("breed")}</span><p className="font-medium">{animal.breed}</p></div>
            <div><span className="text-muted-foreground">{t("age")}</span><p className="font-medium">{formatAge(animal.ageMonths, ageMode)}</p></div>
            <div><span className="text-muted-foreground">{t("dob")}</span><p className="font-medium">{formatDate(animal.dob)}</p></div>
            <div><span className="text-muted-foreground">{t("source")}</span><p className="font-medium">{
              animal.acquisitionType === "PURCHASED"
                ? t("purchased")
                : animal.acquisitionType === "GIFT"
                  ? t("gift")
                  : t("bornOnFarm")
            }</p></div>
            {(animal.acquisitionType === "PURCHASED" || animal.acquisitionType === "GIFT") && (
              <div>
                <span className="text-muted-foreground">{t("acquisitionDate")}</span>
                <p className="font-medium">{formatDate(animal.acquisitionDate)}</p>
              </div>
            )}
            <div><span className="text-muted-foreground">{t("camp")}</span><p className="font-medium">{animal.camp.name}</p></div>
            <div><span className="text-muted-foreground">{t("owner")}</span><p className="font-medium">{animal.owner.name}</p></div>
            <div><span className="text-muted-foreground">{t("sire")}</span><p className="font-medium">{animal.sire?.eartag || "—"}</p></div>
            <div><span className="text-muted-foreground">{t("dam")}</span><p className="font-medium">{animal.dam?.eartag || "—"}</p></div>
            <div><span className="text-muted-foreground">{t("colorMarkings")}</span><p className="font-medium">{animal.colorMarkings || "—"}</p></div>
            <div>
              <span className="text-muted-foreground">{t("tagColor")}</span>
              <p className="font-medium mt-0.5">
                <TagColorSwatch
                  color={
                    resolveTagColor({
                      animalTagColor: animal.tagColor,
                      campTagColor: animal.camp.tagColor,
                      defaultTagColor,
                      dob: animal.dob,
                      ageMonths: animal.ageMonths,
                      yearColors,
                    }).color
                  }
                  locale={locale}
                />
              </p>
            </div>
            {animal.sex === "MALE" && canEdit && !isClosed && (
              <div>
                <span className="text-muted-foreground">{t("castrated")}</span>
                <label className="flex items-center gap-2 mt-1 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={!!animal.isCastrated}
                    disabled={statusSaving}
                    onChange={(e) => toggleSexStatus("isCastrated", e.target.checked)}
                  />
                  {animal.isCastrated ? t("yes") : t("no")}
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Checking this adds a castration event to the timeline.
                </p>
              </div>
            )}
            {animal.sex === "FEMALE" && canEdit && !isClosed && (
              <div>
                <span className="text-muted-foreground">{t("pregnant")}</span>
                <label className="flex items-center gap-2 mt-1 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={!!animal.isPregnant}
                    disabled={statusSaving}
                    onChange={(e) => toggleSexStatus("isPregnant", e.target.checked)}
                  />
                  {animal.isPregnant ? t("yes") : t("no")}
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Clear after calving, or when confirmed open after breeding season.
                  Linking a calf or recording calving clears this automatically.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4" />
            {t("standingNotes")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("standingNotesHelp")}</p>
          {animal.notes?.trim() ? (
            <p className="text-sm whitespace-pre-wrap">{animal.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noStandingNotes")}</p>
          )}
          {canEdit && !editingDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => startEditDetails(animal)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" /> {t("editDetails")}
            </Button>
          )}
        </CardContent>
      </Card>

      {editingDetails && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("editAnimalDetails")}</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveDetails} disabled={savingDetails}>
                {savingDetails ? t("saving") : t("save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingDetails(false)}>
                {t("cancel")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
              <div className="space-y-2">
                <Label>{t("eartag")} *</Label>
                <Input
                  value={editForm.eartag}
                  onChange={(e) => setEditForm({ ...editForm, eartag: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("breed")} *</Label>
                <Select value={editForm.breed} onValueChange={(v) => setEditForm({ ...editForm, breed: v })}>
                  <SelectTrigger><SelectValue placeholder={t("breed")} /></SelectTrigger>
                  <SelectContent>
                    {breeds.map((b) => (
                      <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                    ))}
                    {editForm.breed && !breeds.some((b) => b.name === editForm.breed) && (
                      <SelectItem value={editForm.breed}>{editForm.breed}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("sex")}</Label>
                <Select value={editForm.sex} onValueChange={(v) => setEditForm({ ...editForm, sex: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">{t("male")}</SelectItem>
                    <SelectItem value="FEMALE">{t("female")}</SelectItem>
                    <SelectItem value="UNKNOWN">{t("unknownSex")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isClosed && (
                <div className="space-y-2">
                  <Label>{t("status")}</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">{t("active")}</SelectItem>
                      <SelectItem value="MISSING">{t("statusMissing")}</SelectItem>
                      <SelectItem value="QUARANTINE">{t("quarantine")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("dob")}</Label>
                <Input
                  type="date"
                  value={editForm.dob}
                  onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                />
              </div>
              {!editForm.dob && (
                <>
                  <div className="space-y-2">
                    <Label>{t("ageYears")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.ageYears}
                      onChange={(e) => setEditForm({ ...editForm, ageYears: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("ageMonthsPart")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={11}
                      value={editForm.ageMonthsPart}
                      onChange={(e) => setEditForm({ ...editForm, ageMonthsPart: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>{t("camp")}</Label>
                <Select value={editForm.campId} onValueChange={(v) => setEditForm({ ...editForm, campId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {camps.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("owner")}</Label>
                <Select value={editForm.ownerId} onValueChange={(v) => setEditForm({ ...editForm, ownerId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                    {editForm.ownerId && !owners.some((o) => o.id === editForm.ownerId) && (
                      <SelectItem value={editForm.ownerId}>{animal.owner.name}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("sire")}</Label>
                <Select
                  value={editForm.sireId || "__none__"}
                  onValueChange={(v) =>
                    setEditForm({
                      ...editForm,
                      sireId: v === "__none__" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger><SelectValue placeholder={t("none")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("none")}</SelectItem>
                    {(() => {
                      const males = parentAnimals.filter((a) => a.sex === "MALE");
                      const inCamp = males
                        .filter((a) => a.campId === editForm.campId)
                        .sort((a, b) => a.eartag.localeCompare(b.eartag));
                      const other = males
                        .filter((a) => a.campId !== editForm.campId)
                        .sort((a, b) => a.eartag.localeCompare(b.eartag));
                      return (
                        <>
                          {inCamp.length > 0 && (
                            <>
                              <SelectItem value="__hdr_sire_camp__" disabled>
                                — {t("parentsInCamp")} —
                              </SelectItem>
                              {inCamp.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.eartag}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {other.length > 0 && (
                            <>
                              <SelectItem value="__hdr_sire_other__" disabled>
                                — {t("parentsOtherCamps")} —
                              </SelectItem>
                              {other.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.eartag}
                                  {a.campName ? ` · ${a.campName}` : ""}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("sireMaleOnly")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("dam")}</Label>
                <Select
                  value={editForm.damId || "__none__"}
                  onValueChange={(v) =>
                    setEditForm({
                      ...editForm,
                      damId: v === "__none__" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger><SelectValue placeholder={t("none")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("none")}</SelectItem>
                    {(() => {
                      const females = parentAnimals.filter((a) => a.sex === "FEMALE");
                      const inCamp = females
                        .filter((a) => a.campId === editForm.campId)
                        .sort((a, b) => a.eartag.localeCompare(b.eartag));
                      const other = females
                        .filter((a) => a.campId !== editForm.campId)
                        .sort((a, b) => a.eartag.localeCompare(b.eartag));
                      return (
                        <>
                          {inCamp.length > 0 && (
                            <>
                              <SelectItem value="__hdr_dam_camp__" disabled>
                                — {t("parentsInCamp")} —
                              </SelectItem>
                              {inCamp.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.eartag}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {other.length > 0 && (
                            <>
                              <SelectItem value="__hdr_dam_other__" disabled>
                                — {t("parentsOtherCamps")} —
                              </SelectItem>
                              {other.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.eartag}
                                  {a.campName ? ` · ${a.campName}` : ""}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("damFemaleOnly")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("acquisitionType")}</Label>
                <Select
                  value={editForm.acquisitionType}
                  onValueChange={(v) =>
                    setEditForm({
                      ...editForm,
                      acquisitionType: v,
                      acquisitionDate:
                        v === "BORN_ON_FARM" ? "" : editForm.acquisitionDate,
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BORN_ON_FARM">{t("bornOnFarm")}</SelectItem>
                    <SelectItem value="PURCHASED">{t("purchased")}</SelectItem>
                    <SelectItem value="GIFT">{t("gift")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(editForm.acquisitionType === "PURCHASED" ||
                editForm.acquisitionType === "GIFT") && (
                <div className="space-y-2">
                  <Label>{t("acquisitionDate")}</Label>
                  <Input
                    type="date"
                    value={editForm.acquisitionDate}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        acquisitionDate: e.target.value,
                      })
                    }
                  />
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("colorMarkings")}</Label>
                <Input
                  value={editForm.colorMarkings}
                  onChange={(e) => setEditForm({ ...editForm, colorMarkings: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("tagColorAnimalOverride")}</Label>
                <Select
                  value={editForm.tagColor || "none"}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, tagColor: v === "none" ? "" : v })
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
                <p className="text-xs text-muted-foreground">{t("tagColorHelp")}</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("standingNotes")}</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={4}
                  placeholder={t("standingNotesHelp")}
                />
              </div>
              {isClosed && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  {t("closedAnimalNotice", { status: animal.status.toLowerCase() })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="events">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="events">{t("tabEvents")}</TabsTrigger>
          <TabsTrigger value="weights">{t("tabWeights")}</TabsTrigger>
          <TabsTrigger value="health">{t("tabHealth")}</TabsTrigger>
          <TabsTrigger value="vaccinations">{t("tabVaccinations")}</TabsTrigger>
          <TabsTrigger value="treatments">{t("tabTreatments")}</TabsTrigger>
          <TabsTrigger value="movements">{t("tabMovements")}</TabsTrigger>
          <TabsTrigger value="sales">{t("tabSales")}</TabsTrigger>
          <TabsTrigger value="death">{t("tabDeath")}</TabsTrigger>
          <TabsTrigger value="pedigree">{t("tabPedigree")}</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t("eventTimeline")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canManageEvents && !isClosed && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <Label>{t("quickNote")}</Label>
                  <Textarea
                    placeholder={t("quickNotePlaceholder")}
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    rows={2}
                  />
                  <Button
                    size="sm"
                    onClick={addQuickNote}
                    disabled={savingQuickNote || !quickNote.trim()}
                  >
                    {savingQuickNote ? t("saving") : t("addQuickNote")}
                  </Button>
                </div>
              )}
              {(animal.events || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
              ) : (
                <div className="space-y-3">
                  {animal.events.map((ev) => (
                    <div key={ev.id} className="border-l-2 border-primary/30 pl-4 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{ev.type.replace(/_/g, " ")}</Badge>
                        <span className="font-medium">{ev.title}</span>
                      </div>
                      {ev.description && <p className="text-sm text-muted-foreground mt-1">{ev.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(ev.occurredAt)}
                        {ev.recordedBy ? ` · ${ev.recordedBy.name}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {!isClosed && canManageEvents && (
                <div className="grid gap-2 pt-4 border-t max-w-lg">
                  <Select value={eventForm.type} onValueChange={(v) => setEventForm({ ...eventForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOTE">{t("eventTypeNote")}</SelectItem>
                      <SelectItem value="QUARANTINE">{t("quarantine")}</SelectItem>
                      <SelectItem value="OTHER">{t("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder={t("eventTitle")} value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} />
                  <Textarea placeholder={t("description")} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} />
                  <Input type="date" value={eventForm.occurredAt} onChange={(e) => setEventForm({ ...eventForm, occurredAt: e.target.value })} />
                  <Button onClick={addEvent}>{t("addEvent")}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weights" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t("weightHistory")}</CardTitle></CardHeader>
            <CardContent>
              {weightChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={weightChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-sm">{t("noWeightRecords")}</p>
              )}
              {animal.weightLogs.length > 0 && (
                <div className="mt-4 space-y-2">
                  {animal.weightLogs.map((w) => (
                    <div key={w.id} className="flex items-center justify-between border-b pb-2 text-sm">
                      <div>
                        <span className="font-medium">{w.weightKg} kg</span>
                        <span className="text-muted-foreground ml-2">
                          {formatDate(w.date)} · {w.recordedBy.name}
                        </span>
                      </div>
                      {canUpdateRecords && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deletingId === w.id}
                          onClick={() => deleteSubRecord("weights", w.id)}
                          aria-label={t("delete")}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!isClosed && canUpdateRecords && (
                <div className="flex gap-2 mt-4">
                  <Input type="number" placeholder={t("weightKg")} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="max-w-xs" />
                  <Button onClick={addWeight}>{t("recordWeight")}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t("healthRecords")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {animal.healthRecords.map((r) => (
                <div key={r.id} className="border-b pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <Badge variant="outline">{t(healthTypeKey(r.type))}</Badge>
                        <span className="text-sm text-muted-foreground">{formatDate(r.date)}</span>
                      </div>
                      {r.diagnosis && <p className="text-sm mt-1">{r.diagnosis}</p>}
                      {r.treatment && <p className="text-sm text-muted-foreground">{r.treatment}</p>}
                    </div>
                    {canManageHealth && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deletingId === r.id}
                        onClick={() => deleteSubRecord("health", r.id)}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!isClosed && canManageHealth && (
                <div className="grid gap-2 pt-4 border-t">
                  <Select value={healthForm.type} onValueChange={(v) => setHealthForm({ ...healthForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CHECKUP">{t("checkup")}</SelectItem>
                      <SelectItem value="ILLNESS">{t("illness")}</SelectItem>
                      <SelectItem value="INJURY">{t("injury")}</SelectItem>
                      <SelectItem value="OTHER">{t("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder={t("diagnosis")} value={healthForm.diagnosis} onChange={(e) => setHealthForm({ ...healthForm, diagnosis: e.target.value })} />
                  <Input placeholder={t("treatment")} value={healthForm.treatment} onChange={(e) => setHealthForm({ ...healthForm, treatment: e.target.value })} />
                  <Button onClick={addHealth}>{t("addHealthRecord")}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vaccinations">
          <Card>
            <CardHeader><CardTitle>{t("tabVaccinations")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {animal.vaccinations.map((v) => (
                <div key={v.id} className="border-b pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{v.vaccineName}</span>
                        <span className="text-sm text-muted-foreground">{formatDate(v.date)}</span>
                      </div>
                      {v.nextDue && <p className="text-sm text-muted-foreground">{t("nextDue")}: {formatDate(v.nextDue)}</p>}
                    </div>
                    {canManageHealth && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deletingId === v.id}
                        onClick={() => deleteSubRecord("vaccinations", v.id)}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!isClosed && canManageHealth && (
                <div className="grid gap-2 pt-4 border-t">
                  {vaccineOptions.length > 0 && (
                    <Select
                      value={vaccForm.vaccineCatalogId || "__custom__"}
                      onValueChange={onVaccineCatalogChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("optionalSchedule")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__custom__">{t("customOneOff")}</SelectItem>
                        {vaccineOptions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                            {v.intervalDays ? ` (${t("everyNDays", { n: v.intervalDays })})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    placeholder={t("vaccineName")}
                    value={vaccForm.vaccineName}
                    onChange={(e) =>
                      setVaccForm({
                        ...vaccForm,
                        vaccineName: e.target.value,
                        vaccineCatalogId: "",
                      })
                    }
                  />
                  <Input
                    placeholder={t("batchNo")}
                    value={vaccForm.batchNo}
                    onChange={(e) => setVaccForm({ ...vaccForm, batchNo: e.target.value })}
                  />
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t("nextDueOptional")}
                    </Label>
                    <Input
                      type="date"
                      value={vaccForm.nextDue}
                      onChange={(e) => setVaccForm({ ...vaccForm, nextDue: e.target.value })}
                    />
                  </div>
                  <Button onClick={addVaccination}>{t("recordVaccination")}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="treatments">
          <Card>
            <CardHeader><CardTitle>{t("tabTreatments")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {animal.treatments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noTreatments")}</p>
              ) : (
                animal.treatments.map((tr) => (
                  <div key={tr.id} className="border-b pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">
                            {tr.product}{" "}
                            <Badge variant="outline" className="ml-1">
                              {t(treatmentTypeKey(tr.type))}
                            </Badge>
                          </span>
                          <span className="text-sm text-muted-foreground shrink-0">
                            {formatDate(tr.date)}
                          </span>
                        </div>
                        {tr.dose && (
                          <p className="text-sm text-muted-foreground">{t("dose")}: {tr.dose}</p>
                        )}
                        {tr.nextDue && (
                          <p className="text-sm text-muted-foreground">
                            {t("nextDue")}: {formatDate(tr.nextDue)}
                          </p>
                        )}
                      </div>
                      {canManageHealth && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deletingId === tr.id}
                          onClick={() => deleteSubRecord("treatments", tr.id)}
                          aria-label={t("delete")}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {!isClosed && canManageHealth && (
                <div className="grid gap-2 pt-4 border-t">
                  {treatmentOptions.length > 0 && (
                    <Select
                      value={treatForm.treatmentCatalogId || "__custom__"}
                      onValueChange={onTreatmentCatalogChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("optionalSchedule")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__custom__">{t("customOneOff")}</SelectItem>
                        {treatmentOptions.map((to) => (
                          <SelectItem key={to.id} value={to.id}>
                            {to.name}
                            {to.intervalDays ? ` (${t("everyNDays", { n: to.intervalDays })})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!treatForm.treatmentCatalogId && (
                    <Select
                      value={treatForm.type}
                      onValueChange={(v) => setTreatForm({ ...treatForm, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEWORMING">{t("deworming")}</SelectItem>
                        <SelectItem value="DIPPING">{t("dipping")}</SelectItem>
                        <SelectItem value="ANTIBIOTIC">{t("antibiotic")}</SelectItem>
                        <SelectItem value="OTHER">{t("other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    placeholder={t("product")}
                    value={treatForm.product}
                    onChange={(e) =>
                      setTreatForm({
                        ...treatForm,
                        product: e.target.value,
                        treatmentCatalogId: "",
                      })
                    }
                  />
                  <Input
                    placeholder={t("dose")}
                    value={treatForm.dose}
                    onChange={(e) => setTreatForm({ ...treatForm, dose: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder={t("withdrawalDays")}
                    value={treatForm.withdrawalPeriod}
                    onChange={(e) =>
                      setTreatForm({ ...treatForm, withdrawalPeriod: e.target.value })
                    }
                  />
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t("nextDueOptional")}
                    </Label>
                    <Input
                      type="date"
                      value={treatForm.nextDue}
                      onChange={(e) =>
                        setTreatForm({ ...treatForm, nextDue: e.target.value })
                      }
                    />
                  </div>
                  <Button onClick={addTreatment}>{t("recordTreatment")}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader><CardTitle>{t("movementHistory")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {animal.movements.map((m) => (
                <div key={m.id} className="border-b pb-2">
                  <p className="font-medium">{m.fromCamp.name} → {m.toCamp.name}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(m.date)} · {m.authorizedBy.name}</p>
                </div>
              ))}
              {!isClosed && canMove && (
                <div className="flex gap-2 pt-4 border-t">
                  <Select value={moveCampId} onValueChange={setMoveCampId}>
                    <SelectTrigger className="max-w-xs"><SelectValue placeholder={t("moveToCamp")} /></SelectTrigger>
                    <SelectContent>
                      {camps.filter((c) => c.id !== animal.camp.id).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={moveAnimal}>{t("moveAnimal")}</Button>
                </div>
              )}
              {!isClosed && !canMove && (
                <p className="text-sm text-muted-foreground pt-2 border-t">
                  {t("onlyOwnerManagerMove")}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>{latestSale ? t("saleRecord") : t("recordSale")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestSale ? (
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("saleDate")}</span>
                    <p className="font-medium">{formatDate(latestSale.saleDate)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("buyer")}</span>
                    <p className="font-medium">{latestSale.buyer}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("price")}</span>
                    <p className="font-medium">{formatCurrency(latestSale.priceTzs)}</p>
                  </div>
                  {latestSale.weightAtSale != null && (
                    <div>
                      <span className="text-muted-foreground">{t("weightAtSale")}</span>
                      <p className="font-medium">{latestSale.weightAtSale} kg</p>
                    </div>
                  )}
                  {latestSale.weightAtSale != null && latestSale.weightAtSale > 0 && (
                    <div>
                      <span className="text-muted-foreground">{t("pricePerKg")}</span>
                      <p className="font-medium">
                        {formatCurrency(Math.round(latestSale.priceTzs / latestSale.weightAtSale))}
                      </p>
                    </div>
                  )}
                  {latestSale.transport && (
                    <div>
                      <span className="text-muted-foreground">{t("transport")}</span>
                      <p className="font-medium">{latestSale.transport}</p>
                    </div>
                  )}
                  {latestSale.notes && (
                    <p className="sm:col-span-2 text-muted-foreground">{latestSale.notes}</p>
                  )}
                  {(animal.sales?.length ?? 0) > 1 && (
                    <div className="sm:col-span-2 space-y-2 pt-2 border-t">
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">{t("earlierSales")}</p>
                      {animal.sales.slice(1).map((s) => (
                        <div key={s.id} className="flex justify-between gap-2">
                          <span>{formatDate(s.saleDate)} · {s.buyer}</span>
                          <span className="font-medium">{formatCurrency(s.priceTzs)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : isDeceased ? (
                <p className="text-sm text-muted-foreground">{t("cannotSellDeceased")}</p>
              ) : canSell ? (
                <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
                  <div className="sm:col-span-2 space-y-2">
                    <Label>{t("buyerContact")}</Label>
                    <Input
                      placeholder={t("searchBuyersPlaceholder")}
                      value={buyerSearch}
                      onChange={(e) => searchBuyers(e.target.value)}
                    />
                    <Select
                      value={saleForm.buyerId || "new"}
                      onValueChange={(v) => {
                        if (v === "new") {
                          setSaleForm({ ...saleForm, buyerId: "", buyer: buyerSearch });
                        } else {
                          const b = buyerOptions.find((x) => x.id === v);
                          setSaleForm({
                            ...saleForm,
                            buyerId: v,
                            buyer: b?.name || "",
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectBuyerPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">{t("oneOffNewBuyer")}</SelectItem>
                        {buyerOptions.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                            {b.phone ? ` · ${b.phone}` : ""}
                            {b.location ? ` · ${b.location}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!saleForm.buyerId && (
                      <>
                        <Input
                          placeholder={`${t("buyerName")} *`}
                          value={saleForm.buyer}
                          onChange={(e) => setSaleForm({ ...saleForm, buyer: e.target.value })}
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={saleForm.createBuyer}
                            onChange={(e) =>
                              setSaleForm({ ...saleForm, createBuyer: e.target.checked })
                            }
                          />
                          {t("saveBuyerContact")}
                        </label>
                      </>
                    )}
                  </div>
                  <Input
                    type="number"
                    placeholder={`${t("priceTzs")} *`}
                    value={saleForm.priceTzs}
                    onChange={(e) => setSaleForm({ ...saleForm, priceTzs: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder={t("weightAtSaleKg")}
                    value={saleForm.weightAtSale}
                    onChange={(e) => setSaleForm({ ...saleForm, weightAtSale: e.target.value })}
                  />
                  <Input
                    type="date"
                    value={saleForm.saleDate}
                    onChange={(e) => setSaleForm({ ...saleForm, saleDate: e.target.value })}
                  />
                  <Input
                    placeholder={t("transportLogistics")}
                    value={saleForm.transport}
                    onChange={(e) => setSaleForm({ ...saleForm, transport: e.target.value })}
                  />
                  <Textarea
                    placeholder={t("notes")}
                    value={saleForm.notes}
                    onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                    className="sm:col-span-2"
                  />
                  <Button onClick={recordSale} disabled={savingSale} className="sm:col-span-2">
                    {savingSale ? t("saving") : t("recordSale")}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noSalePermission")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="death">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>{animal.deathRecord ? t("deathRecord") : t("recordDeathCulling")}</CardTitle>
              {animal.deathRecord && canEditDeath && !editingDeath && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEditDeath(animal.deathRecord!)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" /> {t("editDeathRecord")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {animal.deathRecord && !editingDeath ? (
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  {animal.deathRecord.photoUrl && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">{t("deathEvidencePhoto")}</span>
                      <a
                        href={animal.deathRecord.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block max-w-sm overflow-hidden rounded-lg border bg-muted"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={animal.deathRecord.photoUrl}
                          alt={t("deathEvidencePhoto")}
                          className="h-48 w-full object-cover"
                        />
                      </a>
                    </div>
                  )}
                  <div><span className="text-muted-foreground">{t("date")}</span><p className="font-medium">{formatDate(animal.deathRecord.date)}</p></div>
                  <div><span className="text-muted-foreground">{t("cause")}</span><p className="font-medium">{t(deathCauseKey(animal.deathRecord.cause))}</p></div>
                  <div><span className="text-muted-foreground">{t("disposal")}</span><p className="font-medium">{t(disposalMethodKey(animal.deathRecord.disposalMethod))}</p></div>
                  <div><span className="text-muted-foreground">{t("recordedBy")}</span><p className="font-medium">{animal.deathRecord.recordedBy.name}</p></div>
                  {animal.deathRecord.causeDetail && (
                    <div className="sm:col-span-2"><span className="text-muted-foreground">{t("causeDetail")}</span><p>{animal.deathRecord.causeDetail}</p></div>
                  )}
                  {animal.deathRecord.location && (
                    <div><span className="text-muted-foreground">{t("location")}</span><p>{animal.deathRecord.location}</p></div>
                  )}
                  {animal.deathRecord.weightKg != null && (
                    <div><span className="text-muted-foreground">{t("weight")}</span><p>{animal.deathRecord.weightKg} kg</p></div>
                  )}
                  {animal.deathRecord.insuranceClaim && (
                    <div className="sm:col-span-2">
                      <Badge variant="warning">{t("insuranceClaim")}</Badge>
                      {animal.deathRecord.claimAmountTzs != null && (
                        <span className="ml-2">TZS {animal.deathRecord.claimAmountTzs.toLocaleString()}</span>
                      )}
                      {animal.deathRecord.claimReference && (
                        <span className="ml-2 text-muted-foreground">{t("ref")}: {animal.deathRecord.claimReference}</span>
                      )}
                    </div>
                  )}
                  {animal.deathRecord.notes && <p className="sm:col-span-2 text-muted-foreground">{animal.deathRecord.notes}</p>}
                </div>
              ) : (canRecordDeath && !animal.deathRecord) || (canEditDeath && editingDeath) ? (
                <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
                  <div className="sm:col-span-2 space-y-2 rounded-md border p-3">
                    <Label>{animal.deathRecord ? t("replaceDeathPhoto") : t("deathEartagPhoto")}</Label>
                    <p className="text-xs text-muted-foreground">{t("deathEartagPhotoHint")}</p>
                    <PhotoSourcePicker
                      multiple={false}
                      disabled={savingDeath}
                      onFiles={(files) => setDeathPhotoFile(files[0] || null)}
                    />
                    {(deathPhotoPreview[0] || animal.deathRecord?.photoUrl) && (
                      <div className="mt-2 overflow-hidden rounded-md border bg-muted max-w-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={deathPhotoPreview[0] || animal.deathRecord!.photoUrl!}
                          alt={t("deathEvidencePhoto")}
                          className="h-40 w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                  <Input type="date" value={deathForm.date} onChange={(e) => setDeathForm({ ...deathForm, date: e.target.value })} />
                  <Select value={deathForm.cause} onValueChange={(v) => setDeathForm({ ...deathForm, cause: v, isCulling: v === "CULLING" })}>
                    <SelectTrigger><SelectValue placeholder={t("cause")} /></SelectTrigger>
                    <SelectContent>
                      {DEATH_CAUSES.map((c) => (
                        <SelectItem key={c} value={c}>{t(deathCauseKey(c))}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder={t("causeDetail")} value={deathForm.causeDetail} onChange={(e) => setDeathForm({ ...deathForm, causeDetail: e.target.value })} className="sm:col-span-2" />
                  <Select value={deathForm.disposalMethod} onValueChange={(v) => setDeathForm({ ...deathForm, disposalMethod: v })}>
                    <SelectTrigger><SelectValue placeholder={t("disposal")} /></SelectTrigger>
                    <SelectContent>
                      {DISPOSAL_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{t(disposalMethodKey(m))}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder={t("location")} value={deathForm.location} onChange={(e) => setDeathForm({ ...deathForm, location: e.target.value })} />
                  <Input type="number" placeholder={t("weightAtDeath")} value={deathForm.weightKg} onChange={(e) => setDeathForm({ ...deathForm, weightKg: e.target.value })} />
                  <Input placeholder={t("disposalNotes")} value={deathForm.disposalNotes} onChange={(e) => setDeathForm({ ...deathForm, disposalNotes: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={deathForm.insuranceClaim}
                      onChange={(e) => setDeathForm({ ...deathForm, insuranceClaim: e.target.checked })}
                    />
                    {t("insuranceClaim")}
                  </label>
                  {deathForm.insuranceClaim && (
                    <>
                      <Input type="number" placeholder={t("claimAmount")} value={deathForm.claimAmountTzs} onChange={(e) => setDeathForm({ ...deathForm, claimAmountTzs: e.target.value })} />
                      <Input placeholder={t("claimReference")} value={deathForm.claimReference} onChange={(e) => setDeathForm({ ...deathForm, claimReference: e.target.value })} />
                    </>
                  )}
                  <Textarea placeholder={t("notes")} value={deathForm.notes} onChange={(e) => setDeathForm({ ...deathForm, notes: e.target.value })} className="sm:col-span-2" />
                  {editingDeath ? (
                    <div className="sm:col-span-2 flex flex-wrap gap-2">
                      <Button onClick={saveDeathEdit} disabled={savingDeath}>
                        {savingDeath ? t("saving") : t("save")}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={savingDeath}
                        onClick={() => {
                          setEditingDeath(false);
                          setDeathPhotoFile(null);
                        }}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={recordDeath}
                      disabled={savingDeath}
                      className="sm:col-span-2"
                    >
                      {savingDeath ? t("saving") : t("recordDeathCulling")}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {animal.deathRecord ? t("ownerOnlyAction") : t("deathPublishPermission")}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pedigree" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("pedigreeTree")}</CardTitle>
            </CardHeader>
            <CardContent>
              {pedigree ? (
                <PedigreeTree node={pedigree} />
              ) : (
                <p className="text-muted-foreground">{t("loadingPedigree")}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                {t("offspringTree")}
                {pedigree?.offspringCount != null && pedigree.offspringCount > 0
                  ? ` (${pedigree.offspringCount})`
                  : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pedigree ? (
                <OffspringTree
                  nodes={(pedigree.offspring || []) as Parameters<
                    typeof OffspringTree
                  >[0]["nodes"]}
                />
              ) : (
                <p className="text-muted-foreground">{t("loadingPedigree")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
