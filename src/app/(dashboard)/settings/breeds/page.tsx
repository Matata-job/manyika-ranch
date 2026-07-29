"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus } from "lucide-react";

interface Breed {
  id: string;
  name: string;
  description: string | null;
}

export default function BreedsPage() {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  async function loadBreeds() {
    const res = await fetch("/api/breeds");
    if (res.ok) setBreeds(await res.json());
  }

  useEffect(() => { loadBreeds(); }, []);

  async function addBreed(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/breeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to add breed");
      return;
    }
    setForm({ name: "", description: "" });
    setShowForm(false);
    loadBreeds();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/animals/new" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to register animal
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Breeds</h1>
          <p className="text-muted-foreground">Manage breeds available when registering animals</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />Add Breed
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New Breed</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addBreed} className="space-y-4">
              <div className="space-y-2">
                <Label>Breed name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Boran, Sahiwal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional notes about this breed"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Add Breed"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{breeds.length} breeds</CardTitle></CardHeader>
        <CardContent>
          {breeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No breeds yet. Add your first breed above.</p>
          ) : (
            <ul className="divide-y">
              {breeds.map((b) => (
                <li key={b.id} className="py-3 flex justify-between gap-4">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    {b.description && <p className="text-sm text-muted-foreground">{b.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
