"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";

interface Vaccine {
  id: string;
  name: string;
  intervalDays: number | null;
  description: string | null;
}

interface TreatmentSchedule {
  id: string;
  name: string;
  type: string;
  intervalDays: number | null;
  withdrawalPeriod: number | null;
  description: string | null;
}

const TREATMENT_TYPES = [
  { value: "DEWORMING", label: "Deworming" },
  { value: "DIPPING", label: "Dipping" },
  { value: "ANTIBIOTIC", label: "Antibiotic" },
  { value: "OTHER", label: "Other" },
] as const;

export default function HealthSchedulesPage() {
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [treatments, setTreatments] = useState<TreatmentSchedule[]>([]);
  const [showVaccForm, setShowVaccForm] = useState(false);
  const [showTreatForm, setShowTreatForm] = useState(false);
  const [editingVaccId, setEditingVaccId] = useState<string | null>(null);
  const [editingTreatId, setEditingTreatId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [vaccForm, setVaccForm] = useState({
    name: "",
    intervalDays: "",
    description: "",
  });
  const [treatForm, setTreatForm] = useState({
    name: "",
    type: "DIPPING",
    intervalDays: "",
    withdrawalPeriod: "",
    description: "",
  });

  async function load() {
    const [vRes, tRes] = await Promise.all([
      fetch("/api/health/vaccines"),
      fetch("/api/health/treatment-schedules"),
    ]);
    if (vRes.ok) setVaccines(await vRes.json());
    if (tRes.ok) setTreatments(await tRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  function startEditVaccine(v: Vaccine) {
    setEditingVaccId(v.id);
    setShowVaccForm(true);
    setVaccForm({
      name: v.name,
      intervalDays: v.intervalDays != null ? String(v.intervalDays) : "",
      description: v.description || "",
    });
  }

  function startEditTreatment(t: TreatmentSchedule) {
    setEditingTreatId(t.id);
    setShowTreatForm(true);
    setTreatForm({
      name: t.name,
      type: t.type,
      intervalDays: t.intervalDays != null ? String(t.intervalDays) : "",
      withdrawalPeriod:
        t.withdrawalPeriod != null ? String(t.withdrawalPeriod) : "",
      description: t.description || "",
    });
  }

  function resetVaccForm() {
    setVaccForm({ name: "", intervalDays: "", description: "" });
    setEditingVaccId(null);
    setShowVaccForm(false);
  }

  function resetTreatForm() {
    setTreatForm({
      name: "",
      type: "DIPPING",
      intervalDays: "",
      withdrawalPeriod: "",
      description: "",
    });
    setEditingTreatId(null);
    setShowTreatForm(false);
  }

  async function saveVaccine(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = editingVaccId
      ? `/api/health/vaccines/${editingVaccId}`
      : "/api/health/vaccines";
    const res = await fetch(url, {
      method: editingVaccId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: vaccForm.name,
        intervalDays: vaccForm.intervalDays || null,
        description: vaccForm.description || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to save vaccine");
      return;
    }
    resetVaccForm();
    load();
  }

  async function saveTreatment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = editingTreatId
      ? `/api/health/treatment-schedules/${editingTreatId}`
      : "/api/health/treatment-schedules";
    const res = await fetch(url, {
      method: editingTreatId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: treatForm.name,
        type: treatForm.type,
        intervalDays: treatForm.intervalDays || null,
        withdrawalPeriod: treatForm.withdrawalPeriod || null,
        description: treatForm.description || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to save treatment schedule");
      return;
    }
    resetTreatForm();
    load();
  }

  async function deleteVaccine(id: string) {
    if (!confirm("Delete this vaccine from the catalog?")) return;
    const res = await fetch(`/api/health/vaccines/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to delete");
      return;
    }
    load();
  }

  async function deleteTreatment(id: string) {
    if (!confirm("Delete this treatment schedule?")) return;
    const res = await fetch(`/api/health/treatment-schedules/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to delete");
      return;
    }
    load();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link
          href="/health"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Health
        </Link>
        <h1 className="text-3xl font-bold">Health schedules</h1>
        <p className="text-muted-foreground">
          Define vaccines and recurring treatments. Recording one sets the next due date automatically.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Vaccination schedules</h2>
          <Button
            onClick={() => {
              resetVaccForm();
              setShowVaccForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add vaccine
          </Button>
        </div>

        {showVaccForm && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingVaccId ? "Edit vaccine" : "New vaccine"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveVaccine} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={vaccForm.name}
                    onChange={(e) =>
                      setVaccForm({ ...vaccForm, name: e.target.value })
                    }
                    placeholder="e.g. Anthrax, FMD"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interval (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={vaccForm.intervalDays}
                    onChange={(e) =>
                      setVaccForm({ ...vaccForm, intervalDays: e.target.value })
                    }
                    placeholder="e.g. 365"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={vaccForm.description}
                    onChange={(e) =>
                      setVaccForm({ ...vaccForm, description: e.target.value })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : editingVaccId ? "Update" : "Add"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetVaccForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{vaccines.length} vaccines</CardTitle>
          </CardHeader>
          <CardContent>
            {vaccines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No vaccines yet. Add ones your ranch uses regularly.
              </p>
            ) : (
              <ul className="divide-y">
                {vaccines.map((v) => (
                  <li
                    key={v.id}
                    className="py-3 flex justify-between gap-4 items-start"
                  >
                    <div>
                      <p className="font-medium">{v.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {v.intervalDays
                          ? `Every ${v.intervalDays} days`
                          : "No interval set"}
                      </p>
                      {v.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {v.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditVaccine(v)}
                        aria-label="Edit vaccine"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteVaccine(v.id)}
                        aria-label="Delete vaccine"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Treatment schedules</h2>
          <Button
            onClick={() => {
              resetTreatForm();
              setShowTreatForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add treatment
          </Button>
        </div>

        {showTreatForm && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingTreatId ? "Edit treatment" : "New treatment schedule"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveTreatment} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={treatForm.name}
                    onChange={(e) =>
                      setTreatForm({ ...treatForm, name: e.target.value })
                    }
                    placeholder="e.g. Quarterly dipping"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select
                    value={treatForm.type}
                    onValueChange={(v) =>
                      setTreatForm({ ...treatForm, type: v })
                    }
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Interval (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={treatForm.intervalDays}
                      onChange={(e) =>
                        setTreatForm({
                          ...treatForm,
                          intervalDays: e.target.value,
                        })
                      }
                      placeholder="e.g. 90"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Withdrawal (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={treatForm.withdrawalPeriod}
                      onChange={(e) =>
                        setTreatForm({
                          ...treatForm,
                          withdrawalPeriod: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={treatForm.description}
                    onChange={(e) =>
                      setTreatForm({
                        ...treatForm,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : editingTreatId ? "Update" : "Add"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetTreatForm}
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
            <CardTitle>{treatments.length} treatment schedules</CardTitle>
          </CardHeader>
          <CardContent>
            {treatments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No treatment schedules yet. Add dipping, deworming, etc.
              </p>
            ) : (
              <ul className="divide-y">
                {treatments.map((t) => (
                  <li
                    key={t.id}
                    className="py-3 flex justify-between gap-4 items-start"
                  >
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.type.replace(/_/g, " ")}
                        {t.intervalDays ? ` · every ${t.intervalDays} days` : ""}
                        {t.withdrawalPeriod != null
                          ? ` · ${t.withdrawalPeriod}d withdrawal`
                          : ""}
                      </p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditTreatment(t)}
                        aria-label="Edit treatment"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTreatment(t.id)}
                        aria-label="Delete treatment"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
