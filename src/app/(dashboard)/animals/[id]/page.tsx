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
import { formatDate } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PedigreeTree } from "@/components/pedigree-tree";
import { ArrowLeft } from "lucide-react";

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

interface AnimalDetail {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  dob: string | null;
  ageMonths: number | null;
  status: string;
  photoUrl: string | null;
  colorMarkings: string | null;
  notes: string | null;
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
  const [animal, setAnimal] = useState<AnimalDetail | null>(null);
  const [pedigree, setPedigree] = useState<Record<string, unknown> | null>(null);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
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

  async function loadAnimal() {
    const res = await fetch(`/api/animals/${id}`);
    if (res.ok) setAnimal(await res.json());
  }

  useEffect(() => {
    loadAnimal();
    fetch(`/api/animals/${id}/pedigree`).then((r) => (r.ok ? r.json() : null)).then(setPedigree);
    fetch(`/api/camps?for=movement`).then((r) => r.json()).then(setCamps);
  }, [id]);

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

  if (!animal) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const isDeceased = animal.status === "DECEASED" || !!animal.deathRecord;
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
        <div className="w-full md:w-48 h-48 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {animal.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={animal.photoUrl} alt={animal.eartag} className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl">🐄</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-bold">{animal.eartag}</h1>
            <Badge>{animal.sex}</Badge>
            <Badge variant={isDeceased ? "destructive" : "secondary"}>{animal.status}</Badge>
            {animal.deathRecord?.isCulling && <Badge variant="warning">Culled</Badge>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Breed</span><p className="font-medium">{animal.breed}</p></div>
            <div><span className="text-muted-foreground">Age</span><p className="font-medium">{animal.ageMonths ?? "—"} months</p></div>
            <div><span className="text-muted-foreground">DOB</span><p className="font-medium">{formatDate(animal.dob)}</p></div>
            <div><span className="text-muted-foreground">Camp</span><p className="font-medium">{animal.camp.name}</p></div>
            <div><span className="text-muted-foreground">Owner</span><p className="font-medium">{animal.owner.name}</p></div>
            <div><span className="text-muted-foreground">Sire</span><p className="font-medium">{animal.sire?.eartag || "—"}</p></div>
            <div><span className="text-muted-foreground">Dam</span><p className="font-medium">{animal.dam?.eartag || "—"}</p></div>
            <div><span className="text-muted-foreground">Markings</span><p className="font-medium">{animal.colorMarkings || "—"}</p></div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="events">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="weights">Weights</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="vaccinations">Vaccinations</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
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

              {!isDeceased && (
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
              {!isDeceased && (
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
                  <div className="flex justify-between">
                    <Badge variant="outline">{r.type}</Badge>
                    <span className="text-sm text-muted-foreground">{formatDate(r.date)}</span>
                  </div>
                  {r.diagnosis && <p className="text-sm mt-1">{r.diagnosis}</p>}
                  {r.treatment && <p className="text-sm text-muted-foreground">{r.treatment}</p>}
                </div>
              ))}
              {!isDeceased && (
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
                  <div className="flex justify-between">
                    <span className="font-medium">{v.vaccineName}</span>
                    <span className="text-sm text-muted-foreground">{formatDate(v.date)}</span>
                  </div>
                  {v.nextDue && <p className="text-sm text-muted-foreground">Next due: {formatDate(v.nextDue)}</p>}
                </div>
              ))}
              {!isDeceased && (
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
              {!isDeceased && (
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
