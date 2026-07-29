"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

interface Camp {
  id: string;
  name: string;
}

interface AnimalRow {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  status: string;
  camp: { id: string; name: string };
}

const TREATMENT_TYPES = [
  { value: "DEWORMING", label: "Deworming" },
  { value: "DIPPING", label: "Dipping" },
  { value: "ANTIBIOTIC", label: "Antibiotic" },
  { value: "OTHER", label: "Other" },
] as const;

export default function BulkTreatmentPage() {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [campId, setCampId] = useState("");
  const [sex, setSex] = useState("all");
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "DIPPING",
    product: "",
    dose: "",
    withdrawalPeriod: "",
    date: "",
    notes: "",
  });
  const [result, setResult] = useState<{
    applied: number;
    skipped: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : []));
  }, []);

  async function loadAnimals(nextCampId: string, nextSex: string) {
    if (!nextCampId) {
      setAnimals([]);
      setSelected(new Set());
      return;
    }
    setLoadingAnimals(true);
    const params = new URLSearchParams({
      camp: nextCampId,
    });
    if (nextSex !== "all") params.set("sex", nextSex);
    const res = await fetch(`/api/animals?${params}`);
    const data = res.ok ? await res.json() : [];
    const list: AnimalRow[] = (Array.isArray(data) ? data : []).filter(
      (a: AnimalRow) => a.status === "ACTIVE" || a.status === "QUARANTINE"
    );
    setAnimals(list);
    setSelected(new Set(list.map((a) => a.id)));
    setLoadingAnimals(false);
  }

  useEffect(() => {
    if (campId) loadAnimals(campId, sex);
  }, [campId, sex]);

  const allSelected = animals.length > 0 && selected.size === animals.length;
  const someSelected = selected.size > 0 && selected.size < animals.length;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(animals.map((a) => a.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedLabel = useMemo(
    () => `${selected.size} of ${animals.length} selected`,
    [selected.size, animals.length]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      alert("Select at least one animal");
      return;
    }
    if (!form.product.trim()) {
      alert("Product is required");
      return;
    }
    if (
      !confirm(
        `Apply ${form.type.replace(/_/g, " ").toLowerCase()} to ${selected.size} animal(s)?`
      )
    ) {
      return;
    }

    setSaving(true);
    setResult(null);
    const res = await fetch("/api/health/bulk-treatment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalIds: [...selected],
        type: form.type,
        product: form.product,
        dose: form.dose || null,
        withdrawalPeriod: form.withdrawalPeriod || null,
        date: form.date || undefined,
        notes: form.notes || null,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Bulk treatment failed");
      return;
    }

    const data = await res.json();
    setResult({ applied: data.applied, skipped: data.skipped });
    setForm({
      type: "DIPPING",
      product: "",
      dose: "",
      withdrawalPeriod: "",
      date: "",
      notes: "",
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/health"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Health
        </Link>
        <h1 className="text-3xl font-bold">Bulk treatment</h1>
        <p className="text-muted-foreground">
          Apply one treatment to many animals in a camp (dip, deworm, etc.)
        </p>
      </div>

      {result && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">
              Applied to <strong>{result.applied}</strong> animal
              {result.applied === 1 ? "" : "s"}
              {result.skipped > 0 && (
                <> · skipped {result.skipped} (inaccessible or not active)</>
              )}
              .
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Choose animals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Camp *</Label>
              <Select
                value={campId || undefined}
                onValueChange={(v) => {
                  setCampId(v);
                  setResult(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select camp" />
                </SelectTrigger>
                <SelectContent>
                  {camps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sex filter</Label>
              <Select value={sex} onValueChange={setSex}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!campId ? (
            <p className="text-sm text-muted-foreground">Select a camp to load animals</p>
          ) : loadingAnimals ? (
            <p className="text-sm text-muted-foreground">Loading animals...</p>
          ) : animals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active animals in this camp</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                  />
                  Select all
                </label>
                <Badge variant="secondary">{selectedLabel}</Badge>
              </div>
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
                    <span className="text-muted-foreground">
                      {a.breed} · {a.sex}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Treatment details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TREATMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product *</Label>
              <Input
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
                placeholder="e.g. Amitraz, Albendazole"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Dose</Label>
              <Input
                value={form.dose}
                onChange={(e) => setForm({ ...form, dose: e.target.value })}
                placeholder="e.g. 10 ml / 100 kg"
              />
            </div>
            <div className="space-y-2">
              <Label>Withdrawal (days)</Label>
              <Input
                type="number"
                min={0}
                value={form.withdrawalPeriod}
                onChange={(e) =>
                  setForm({ ...form, withdrawalPeriod: e.target.value })
                }
                placeholder="Meat/milk safe after N days"
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Batch, weather, crush notes…"
              />
            </div>
            <Button
              type="submit"
              disabled={saving || selected.size === 0 || !campId}
              className="sm:col-span-2"
            >
              {saving
                ? "Applying..."
                : `Apply to ${selected.size} animal${selected.size === 1 ? "" : "s"}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
