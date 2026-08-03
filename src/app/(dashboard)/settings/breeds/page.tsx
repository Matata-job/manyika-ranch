"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";

interface Breed {
  id: string;
  name: string;
  description: string | null;
}

export default function BreedsPage() {
  const t = useT();
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  async function loadBreeds() {
    const res = await fetch("/api/breeds");
    if (res.ok) setBreeds(await res.json());
  }

  useEffect(() => {
    loadBreeds();
  }, []);

  async function addBreed(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/breeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert((err as { error?: string }).error || t("failedToSave"));
      return;
    }
    setForm({ name: "", description: "" });
    setShowForm(false);
    loadBreeds();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/animals/new"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> {t("backToRegister")}
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("breedsTitle")}</h1>
          <p className="text-muted-foreground">{t("breedsSubtitle")}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("addBreed")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t("newBreed")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addBreed} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("breedName")} *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Boran, Sahiwal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("breedDescription")}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder={t("breedDescriptionPlaceholder")}
                />
              </div>
              <Button type="submit" disabled={saving || !form.name.trim()}>
                {saving ? t("saving") : t("addBreed")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("breedsCount", { n: breeds.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {breeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noBreeds")}</p>
          ) : (
            <ul className="divide-y">
              {breeds.map((b) => (
                <li key={b.id} className="py-3">
                  <p className="font-medium">{b.name}</p>
                  {b.description && (
                    <p className="text-sm text-muted-foreground">
                      {b.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
