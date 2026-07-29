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
import { PedigreeTree } from "@/components/pedigree-tree";
import { AnimalPhotoGallery, type AnimalPhoto } from "@/components/animal-photo-gallery";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { Label } from "@/components/ui/label";

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
  notes: string | null;
  acquisitionType?: string | null;
  camp: { id: string; name: string };
  owner: { id: string; name: string };
  sire: { id: string; eartag: string } | null;
  dam: { id: string; eartag: string } | null;
  weightLogs: { id: string; date: string; weightKg: number; recordedBy: { name: string } }[];
  healthRecords: { id: string; date: string; type: string; diagnosis: string | null; treatment: string | null }[];
  vaccinations: { id: string; date: string; vaccineName: string; nextDue: string | null; batchNo: string | null }[];
  treatments: { id: string; date: string; type: string; product: string; dose: string | null }[];
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

export default function AnimalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canEdit = role ? hasPermission(role, "editAnimal") : false;
  const canManageHealth = role ? hasPermission(role, "manageHealth") : false;
  const canSell = role ? hasPermission(role, "manageSales") : false;
  const [animal, setAnimal] = useState<AnimalDetail | null>(null);
  const [ageMode, setAgeMode] = useState<AgeDisplayMode>("AUTO");
  const [statusSaving, setStatusSaving] = useState(false);
  const [pedigree, setPedigree] = useState<Record<string, unknown> | null>(null);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [breeds, setBreeds] = useState<{ id: string; name: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
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
    colorMarkings: "",
    notes: "",
  });
  const [weightKg, setWeightKg] = useState("");
  const [moveCampId, setMoveCampId] = useState("");
  const [healthForm, setHealthForm] = useState({ type: "CHECKUP", diagnosis: "", treatment: "" });
  const [vaccForm, setVaccForm] = useState({ vaccineName: "", batchNo: "", nextDue: "" });
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
      });
    fetch("/api/buyers")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBuyerOptions(Array.isArray(d) ? d : []));
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
      colorMarkings: a.colorMarkings || "",
      notes: a.notes || "",
    });
    setEditingDetails(true);
  }

  async function saveDetails() {
    if (!editForm.eartag.trim() || !editForm.breed) {
      alert("Eartag and breed are required");
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
      notes: editForm.notes || null,
      acquisitionType: editForm.acquisitionType,
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
      alert(err.error || "Failed to update animal");
      return;
    }
    setEditingDetails(false);
    loadAnimal();
  }

  async function deleteSubRecord(
    kind: "weights" | "health" | "vaccinations" | "treatments",
    recordId: string
  ) {
    if (!confirm("Delete this record? This cannot be undone.")) return;
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
      alert(err.error || "Failed to delete");
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
    await fetch(`/api/animals/${id}/vaccinations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...vaccForm, nextDue: vaccForm.nextDue || null }),
    });
    setVaccForm({ vaccineName: "", batchNo: "", nextDue: "" });
    loadAnimal();
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

  async function recordDeath() {
    if (!confirm("Mark this animal as deceased? This cannot be undone from here.")) return;
    setSavingDeath(true);
    const res = await fetch(`/api/animals/${id}/death`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...deathForm,
        date: deathForm.date || undefined,
        weightKg: deathForm.weightKg || null,
        claimAmountTzs: deathForm.claimAmountTzs || null,
        isCulling: deathForm.isCulling || deathForm.cause === "CULLING",
      }),
    });
    setSavingDeath(false);
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to record death");
      return;
    }
    loadAnimal();
  }

  async function recordSale() {
    if ((!saleForm.buyerId && !saleForm.buyer.trim()) || !saleForm.priceTzs) {
      alert("Buyer and price are required");
      return;
    }
    if (!confirm("Record this sale and mark the animal as sold?")) return;
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
      alert(err.error || "Failed to record sale");
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
    return <p className="text-muted-foreground">Loading...</p>;
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
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to animals
      </Link>

      <div className="flex flex-col md:flex-row gap-6">
        <AnimalPhotoGallery
          animalId={id}
          initialPhotos={animal.photos || []}
          coverUrl={animal.photoUrl}
          canEdit={canEdit && !isClosed}
          onPhotosChange={loadAnimal}
        />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-bold">{animal.eartag}</h1>
            <Badge>{animal.sex}</Badge>
            {animal.sex === "MALE" && animal.isCastrated && <Badge variant="outline">Castrated</Badge>}
            {animal.sex === "FEMALE" && animal.isPregnant && <Badge variant="warning">Pregnant</Badge>}
            <Badge variant={isDeceased ? "destructive" : isSold ? "warning" : "secondary"}>{animal.status}</Badge>
            {animal.deathRecord?.isCulling && <Badge variant="warning">Culled</Badge>}
            {canEdit && !editingDetails && (
              <Button variant="outline" size="sm" onClick={() => startEditDetails(animal)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit details
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Breed</span><p className="font-medium">{animal.breed}</p></div>
            <div><span className="text-muted-foreground">Age</span><p className="font-medium">{formatAge(animal.ageMonths, ageMode)}</p></div>
            <div><span className="text-muted-foreground">DOB</span><p className="font-medium">{formatDate(animal.dob)}</p></div>
            <div><span className="text-muted-foreground">Camp</span><p className="font-medium">{animal.camp.name}</p></div>
            <div><span className="text-muted-foreground">Owner</span><p className="font-medium">{animal.owner.name}</p></div>
            <div><span className="text-muted-foreground">Sire</span><p className="font-medium">{animal.sire?.eartag || "—"}</p></div>
            <div><span className="text-muted-foreground">Dam</span><p className="font-medium">{animal.dam?.eartag || "—"}</p></div>
            <div><span className="text-muted-foreground">Markings</span><p className="font-medium">{animal.colorMarkings || "—"}</p></div>
            {animal.sex === "MALE" && canEdit && !isClosed && (
              <div>
                <span className="text-muted-foreground">Castrated</span>
                <label className="flex items-center gap-2 mt-1 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={!!animal.isCastrated}
                    disabled={statusSaving}
                    onChange={(e) => toggleSexStatus("isCastrated", e.target.checked)}
                  />
                  {animal.isCastrated ? "Yes" : "No"}
                </label>
              </div>
            )}
            {animal.sex === "FEMALE" && canEdit && !isClosed && (
              <div>
                <span className="text-muted-foreground">Pregnant</span>
                <label className="flex items-center gap-2 mt-1 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={!!animal.isPregnant}
                    disabled={statusSaving}
                    onChange={(e) => toggleSexStatus("isPregnant", e.target.checked)}
                  />
                  {animal.isPregnant ? "Yes" : "No"}
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingDetails && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Edit Animal Details</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveDetails} disabled={savingDetails}>
                {savingDetails ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingDetails(false)}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
              <div className="space-y-2">
                <Label>Eartag *</Label>
                <Input
                  value={editForm.eartag}
                  onChange={(e) => setEditForm({ ...editForm, eartag: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Breed *</Label>
                <Select value={editForm.breed} onValueChange={(v) => setEditForm({ ...editForm, breed: v })}>
                  <SelectTrigger><SelectValue placeholder="Breed" /></SelectTrigger>
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
                <Label>Sex</Label>
                <Select value={editForm.sex} onValueChange={(v) => setEditForm({ ...editForm, sex: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isClosed && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="MISSING">Missing</SelectItem>
                      <SelectItem value="QUARANTINE">Quarantine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Date of birth</Label>
                <Input
                  type="date"
                  value={editForm.dob}
                  onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                />
              </div>
              {!editForm.dob && (
                <>
                  <div className="space-y-2">
                    <Label>Age — years</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.ageYears}
                      onChange={(e) => setEditForm({ ...editForm, ageYears: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Age — months</Label>
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
                <Label>Camp</Label>
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
                <Label>Owner</Label>
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
                <Label>Acquisition</Label>
                <Select
                  value={editForm.acquisitionType}
                  onValueChange={(v) => setEditForm({ ...editForm, acquisitionType: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BORN_ON_FARM">Born on farm</SelectItem>
                    <SelectItem value="PURCHASED">Purchased</SelectItem>
                    <SelectItem value="GIFT">Gift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Color / markings</Label>
                <Input
                  value={editForm.colorMarkings}
                  onChange={(e) => setEditForm({ ...editForm, colorMarkings: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>
              {isClosed && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  This animal is {animal.status.toLowerCase()}. Identity fields can still be corrected; status cannot be changed here.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="events">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="weights">Weights</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="vaccinations">Vaccinations</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="death">Death / Culling</TabsTrigger>
          <TabsTrigger value="pedigree">Pedigree</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Event Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(animal.events || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded yet</p>
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

              {!isClosed && (
                <div className="grid gap-2 pt-4 border-t max-w-lg">
                  <Select value={eventForm.type} onValueChange={(v) => setEventForm({ ...eventForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOTE">Note</SelectItem>
                      <SelectItem value="QUARANTINE">Quarantine</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Event title" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} />
                  <Textarea placeholder="Description" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} />
                  <Input type="date" value={eventForm.occurredAt} onChange={(e) => setEventForm({ ...eventForm, occurredAt: e.target.value })} />
                  <Button onClick={addEvent}>Add Event</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weights" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Weight History</CardTitle></CardHeader>
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
                <p className="text-muted-foreground text-sm">No weight records yet</p>
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
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deletingId === w.id}
                          onClick={() => deleteSubRecord("weights", w.id)}
                          aria-label="Delete weight"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!isClosed && canEdit && (
                <div className="flex gap-2 mt-4">
                  <Input type="number" placeholder="Weight (kg)" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="max-w-xs" />
                  <Button onClick={addWeight}>Record Weight</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Health Records</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {animal.healthRecords.map((r) => (
                <div key={r.id} className="border-b pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <Badge variant="outline">{r.type}</Badge>
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
                        aria-label="Delete health record"
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
                      <SelectItem value="CHECKUP">Checkup</SelectItem>
                      <SelectItem value="ILLNESS">Illness</SelectItem>
                      <SelectItem value="INJURY">Injury</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Diagnosis" value={healthForm.diagnosis} onChange={(e) => setHealthForm({ ...healthForm, diagnosis: e.target.value })} />
                  <Input placeholder="Treatment" value={healthForm.treatment} onChange={(e) => setHealthForm({ ...healthForm, treatment: e.target.value })} />
                  <Button onClick={addHealth}>Add Health Record</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vaccinations">
          <Card>
            <CardHeader><CardTitle>Vaccinations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {animal.vaccinations.map((v) => (
                <div key={v.id} className="border-b pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{v.vaccineName}</span>
                        <span className="text-sm text-muted-foreground">{formatDate(v.date)}</span>
                      </div>
                      {v.nextDue && <p className="text-sm text-muted-foreground">Next due: {formatDate(v.nextDue)}</p>}
                    </div>
                    {canManageHealth && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deletingId === v.id}
                        onClick={() => deleteSubRecord("vaccinations", v.id)}
                        aria-label="Delete vaccination"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!isClosed && canManageHealth && (
                <div className="grid gap-2 pt-4 border-t">
                  <Input placeholder="Vaccine name" value={vaccForm.vaccineName} onChange={(e) => setVaccForm({ ...vaccForm, vaccineName: e.target.value })} />
                  <Input placeholder="Batch no." value={vaccForm.batchNo} onChange={(e) => setVaccForm({ ...vaccForm, batchNo: e.target.value })} />
                  <Input type="date" value={vaccForm.nextDue} onChange={(e) => setVaccForm({ ...vaccForm, nextDue: e.target.value })} />
                  <Button onClick={addVaccination}>Record Vaccination</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader><CardTitle>Movement History</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {animal.movements.map((m) => (
                <div key={m.id} className="border-b pb-2">
                  <p className="font-medium">{m.fromCamp.name} → {m.toCamp.name}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(m.date)} · {m.authorizedBy.name}</p>
                </div>
              ))}
              {!isClosed && (
                <div className="flex gap-2 pt-4 border-t">
                  <Select value={moveCampId} onValueChange={setMoveCampId}>
                    <SelectTrigger className="max-w-xs"><SelectValue placeholder="Move to camp" /></SelectTrigger>
                    <SelectContent>
                      {camps.filter((c) => c.id !== animal.camp.id).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={moveAnimal}>Move Animal</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>{latestSale ? "Sale Record" : "Record Sale"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestSale ? (
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Sale date</span>
                    <p className="font-medium">{formatDate(latestSale.saleDate)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Buyer</span>
                    <p className="font-medium">{latestSale.buyer}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price</span>
                    <p className="font-medium">{formatCurrency(latestSale.priceTzs)}</p>
                  </div>
                  {latestSale.weightAtSale != null && (
                    <div>
                      <span className="text-muted-foreground">Weight at sale</span>
                      <p className="font-medium">{latestSale.weightAtSale} kg</p>
                    </div>
                  )}
                  {latestSale.weightAtSale != null && latestSale.weightAtSale > 0 && (
                    <div>
                      <span className="text-muted-foreground">Price / kg</span>
                      <p className="font-medium">
                        {formatCurrency(Math.round(latestSale.priceTzs / latestSale.weightAtSale))}
                      </p>
                    </div>
                  )}
                  {latestSale.transport && (
                    <div>
                      <span className="text-muted-foreground">Transport</span>
                      <p className="font-medium">{latestSale.transport}</p>
                    </div>
                  )}
                  {latestSale.notes && (
                    <p className="sm:col-span-2 text-muted-foreground">{latestSale.notes}</p>
                  )}
                  {(animal.sales?.length ?? 0) > 1 && (
                    <div className="sm:col-span-2 space-y-2 pt-2 border-t">
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Earlier sales</p>
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
                <p className="text-sm text-muted-foreground">Cannot sell a deceased animal.</p>
              ) : canSell ? (
                <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Buyer contact</Label>
                    <Input
                      placeholder="Search buyers..."
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
                        <SelectValue placeholder="Select buyer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">One-off / new name…</SelectItem>
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
                          placeholder="Buyer name *"
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
                          Save as buyer contact for future sales
                        </label>
                      </>
                    )}
                  </div>
                  <Input
                    type="number"
                    placeholder="Price (TZS) *"
                    value={saleForm.priceTzs}
                    onChange={(e) => setSaleForm({ ...saleForm, priceTzs: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Weight at sale (kg)"
                    value={saleForm.weightAtSale}
                    onChange={(e) => setSaleForm({ ...saleForm, weightAtSale: e.target.value })}
                  />
                  <Input
                    type="date"
                    value={saleForm.saleDate}
                    onChange={(e) => setSaleForm({ ...saleForm, saleDate: e.target.value })}
                  />
                  <Input
                    placeholder="Transport / logistics"
                    value={saleForm.transport}
                    onChange={(e) => setSaleForm({ ...saleForm, transport: e.target.value })}
                  />
                  <Textarea
                    placeholder="Notes"
                    value={saleForm.notes}
                    onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                    className="sm:col-span-2"
                  />
                  <Button onClick={recordSale} disabled={savingSale} className="sm:col-span-2">
                    {savingSale ? "Saving..." : "Record Sale"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No sale recorded. You do not have permission to record sales.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="death">
          <Card>
            <CardHeader>
              <CardTitle>{animal.deathRecord ? "Death Record" : "Record Death / Culling"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {animal.deathRecord ? (
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div><span className="text-muted-foreground">Date</span><p className="font-medium">{formatDate(animal.deathRecord.date)}</p></div>
                  <div><span className="text-muted-foreground">Cause</span><p className="font-medium">{animal.deathRecord.cause.replace(/_/g, " ")}</p></div>
                  <div><span className="text-muted-foreground">Disposal</span><p className="font-medium">{animal.deathRecord.disposalMethod.replace(/_/g, " ")}</p></div>
                  <div><span className="text-muted-foreground">Recorded by</span><p className="font-medium">{animal.deathRecord.recordedBy.name}</p></div>
                  {animal.deathRecord.causeDetail && (
                    <div className="sm:col-span-2"><span className="text-muted-foreground">Detail</span><p>{animal.deathRecord.causeDetail}</p></div>
                  )}
                  {animal.deathRecord.location && (
                    <div><span className="text-muted-foreground">Location</span><p>{animal.deathRecord.location}</p></div>
                  )}
                  {animal.deathRecord.weightKg != null && (
                    <div><span className="text-muted-foreground">Weight</span><p>{animal.deathRecord.weightKg} kg</p></div>
                  )}
                  {animal.deathRecord.insuranceClaim && (
                    <div className="sm:col-span-2">
                      <Badge variant="warning">Insurance claim</Badge>
                      {animal.deathRecord.claimAmountTzs != null && (
                        <span className="ml-2">TZS {animal.deathRecord.claimAmountTzs.toLocaleString()}</span>
                      )}
                      {animal.deathRecord.claimReference && (
                        <span className="ml-2 text-muted-foreground">Ref: {animal.deathRecord.claimReference}</span>
                      )}
                    </div>
                  )}
                  {animal.deathRecord.notes && <p className="sm:col-span-2 text-muted-foreground">{animal.deathRecord.notes}</p>}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
                  <Input type="date" value={deathForm.date} onChange={(e) => setDeathForm({ ...deathForm, date: e.target.value })} />
                  <Select value={deathForm.cause} onValueChange={(v) => setDeathForm({ ...deathForm, cause: v, isCulling: v === "CULLING" })}>
                    <SelectTrigger><SelectValue placeholder="Cause" /></SelectTrigger>
                    <SelectContent>
                      {DEATH_CAUSES.map((c) => (
                        <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Cause detail" value={deathForm.causeDetail} onChange={(e) => setDeathForm({ ...deathForm, causeDetail: e.target.value })} className="sm:col-span-2" />
                  <Select value={deathForm.disposalMethod} onValueChange={(v) => setDeathForm({ ...deathForm, disposalMethod: v })}>
                    <SelectTrigger><SelectValue placeholder="Disposal" /></SelectTrigger>
                    <SelectContent>
                      {DISPOSAL_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Location" value={deathForm.location} onChange={(e) => setDeathForm({ ...deathForm, location: e.target.value })} />
                  <Input type="number" placeholder="Weight at death (kg)" value={deathForm.weightKg} onChange={(e) => setDeathForm({ ...deathForm, weightKg: e.target.value })} />
                  <Input placeholder="Disposal notes" value={deathForm.disposalNotes} onChange={(e) => setDeathForm({ ...deathForm, disposalNotes: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={deathForm.insuranceClaim}
                      onChange={(e) => setDeathForm({ ...deathForm, insuranceClaim: e.target.checked })}
                    />
                    Insurance claim
                  </label>
                  {deathForm.insuranceClaim && (
                    <>
                      <Input type="number" placeholder="Claim amount (TZS)" value={deathForm.claimAmountTzs} onChange={(e) => setDeathForm({ ...deathForm, claimAmountTzs: e.target.value })} />
                      <Input placeholder="Claim reference" value={deathForm.claimReference} onChange={(e) => setDeathForm({ ...deathForm, claimReference: e.target.value })} />
                    </>
                  )}
                  <Textarea placeholder="Notes" value={deathForm.notes} onChange={(e) => setDeathForm({ ...deathForm, notes: e.target.value })} className="sm:col-span-2" />
                  <Button variant="destructive" onClick={recordDeath} disabled={savingDeath} className="sm:col-span-2">
                    {savingDeath ? "Saving..." : "Record Death / Culling"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pedigree">
          <Card>
            <CardHeader><CardTitle>Pedigree Tree</CardTitle></CardHeader>
            <CardContent>
              {pedigree ? <PedigreeTree node={pedigree} /> : <p className="text-muted-foreground">Loading pedigree...</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
