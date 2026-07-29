"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";

interface BreedingEvent {
  id: string;
  matingDate: string;
  method: string;
  pregnancyConfirmed: boolean;
  dam: { id: string; eartag: string };
  sire: { id: string; eartag: string } | null;
  calving: { id: string; date: string; calf: { id: string; eartag: string } | null } | null;
}

export default function BreedingPage() {
  const t = useT();
  const [events, setEvents] = useState<BreedingEvent[]>([]);
  const [animals, setAnimals] = useState<{ id: string; eartag: string; sex: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [calvingEventId, setCalvingEventId] = useState<string | null>(null);
  const [form, setForm] = useState({ damId: "", sireId: "", matingDate: "", method: "NATURAL" });
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

  useEffect(() => {
    loadEvents();
    fetch("/api/animals?status=ACTIVE").then((r) => r.json()).then(setAnimals);
  }, []);

  async function submitBreeding(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/breeding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ damId: "", sireId: "", matingDate: "", method: "NATURAL" });
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
        birthWeightKg: calvingForm.birthWeightKg ? parseFloat(calvingForm.birthWeightKg) : null,
      }),
    });
    setCalvingEventId(null);
    loadEvents();
  }

  const females = animals.filter((a) => a.sex === "FEMALE");
  const males = animals.filter((a) => a.sex === "MALE");

  return (
    
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("breedingTitle")}</h1>
            <p className="text-muted-foreground">{t("breedingSubtitle")}</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />Record Mating
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle>New Breeding Event</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitBreeding} className="grid gap-4 sm:grid-cols-2 max-w-lg">
                <div className="space-y-2">
                  <Label>{t("dam")}</Label>
                  <Select value={form.damId} onValueChange={(v) => setForm({ ...form, damId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select dam" /></SelectTrigger>
                    <SelectContent>
                      {females.map((a) => <SelectItem key={a.id} value={a.id}>{a.eartag}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("sire")}</Label>
                  <Select value={form.sireId} onValueChange={(v) => setForm({ ...form, sireId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select sire" /></SelectTrigger>
                    <SelectContent>
                      {males.map((a) => <SelectItem key={a.id} value={a.id}>{a.eartag}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("matingDate")}</Label>
                  <Input type="date" value={form.matingDate} onChange={(e) => setForm({ ...form, matingDate: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NATURAL">Natural</SelectItem>
                      <SelectItem value="AI">Artificial Insemination</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="sm:col-span-2">Save</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {calvingEventId && (
          <Card>
            <CardHeader><CardTitle>Record Calving</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitCalving} className="grid gap-4 sm:grid-cols-2 max-w-lg">
                <div className="space-y-2">
                  <Label>Calving Date</Label>
                  <Input type="date" value={calvingForm.date} onChange={(e) => setCalvingForm({ ...calvingForm, date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Calf Eartag</Label>
                  <Input value={calvingForm.calfEartag} onChange={(e) => setCalvingForm({ ...calvingForm, calfEartag: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Calf Sex</Label>
                  <Select value={calvingForm.calfSex} onValueChange={(v) => setCalvingForm({ ...calvingForm, calfSex: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Birth Weight (kg)</Label>
                  <Input type="number" value={calvingForm.birthWeightKg} onChange={(e) => setCalvingForm({ ...calvingForm, birthWeightKg: e.target.value })} />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit">Record Calving</Button>
                  <Button type="button" variant="outline" onClick={() => setCalvingEventId(null)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Breeding Events</CardTitle></CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noBreeding")}</p>
            ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between border-b pb-3">
                  <div>
                    <p className="font-medium">
                      <Link href={`/animals/${ev.dam.id}`} className="text-primary hover:underline">{ev.dam.eartag}</Link>
                      {ev.sire && <> × <Link href={`/animals/${ev.sire.id}`} className="text-primary hover:underline">{ev.sire.eartag}</Link></>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(ev.matingDate)} · {ev.method}
                      {ev.pregnancyConfirmed && ` · ${t("pregnant")}`}
                    </p>
                    {ev.calving && (
                      <p className="text-sm text-green-600">
                        Calved {formatDate(ev.calving.date)}
                        {ev.calving.calf && <> · Calf: {ev.calving.calf.eartag}</>}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {ev.pregnancyConfirmed && !ev.calving && (
                      <Button size="sm" variant="outline" onClick={() => setCalvingEventId(ev.id)}>
                        Record Calving
                      </Button>
                    )}
                    {ev.calving ? <Badge variant="success">Calved</Badge> : <Badge variant="secondary">Pending</Badge>}
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
