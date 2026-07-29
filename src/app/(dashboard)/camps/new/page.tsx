"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/components/providers/locale-provider";

export default function NewCampPage() {
  const t = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    capacity: "",
    latitude: "",
    longitude: "",
    waterSources: "",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/camps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        waterSources: form.waterSources || null,
        notes: form.notes || null,
      }),
    });

    if (res.ok) {
      const camp = await res.json();
      router.push(`/camps/${camp.id}`);
    } else {
      setLoading(false);
    }
  }

  return (
    
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{t("addCamp")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("campName")}</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">{t("capacity")}</Label>
              <Input id="capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input id="latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input id="longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="waterSources">Water Sources</Label>
              <Input id="waterSources" value={form.waterSources} onChange={(e) => setForm({ ...form, waterSources: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>{loading ? t("saving") : t("save")}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>{t("cancel")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    
  );
}
