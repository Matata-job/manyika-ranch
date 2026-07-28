"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { enqueueSync } from "@/lib/sync/offline-db";

export default function NewAnimalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [animals, setAnimals] = useState<{ id: string; eartag: string }[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    eartag: "",
    breed: "",
    sex: "FEMALE",
    dob: "",
    campId: "",
    ownerId: "",
    sireId: "",
    damId: "",
    colorMarkings: "",
    notes: "",
    acquisitionType: "BORN_ON_FARM",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/camps").then((r) => r.json()),
      fetch("/api/users").then((r) => r.ok ? r.json() : []),
      fetch("/api/animals?status=ACTIVE").then((r) => r.json()),
    ]).then(([c, u, a]) => {
      setCamps(c);
      setUsers(u);
      setAnimals(a);
    });
  }, []);

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile) return null;
    const fd = new FormData();
    fd.append("file", photoFile);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...form,
      sireId: form.sireId || null,
      damId: form.damId || null,
      ownerId: form.ownerId || undefined,
      dob: form.dob || null,
    };

    if (!navigator.onLine) {
      await enqueueSync("create", "animal", payload);
      router.push("/animals");
      return;
    }

    let photoUrl = null;
    if (photoFile) photoUrl = await uploadPhoto();

    const res = await fetch("/api/animals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, photoUrl }),
    });

    if (res.ok) {
      const animal = await res.json();
      router.push(`/animals/${animal.id}`);
    } else {
      const err = await res.json();
      alert(err.error || "Failed to create animal");
      setLoading(false);
    }
  }

  return (
    
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Register New Animal</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eartag">Eartag *</Label>
                <Input id="eartag" value={form.eartag} onChange={(e) => setForm({ ...form, eartag: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breed">Breed *</Label>
                <Input id="breed" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sex</Label>
                <Select value={form.sex} onValueChange={(v) => setForm({ ...form, sex: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Camp *</Label>
                <Select value={form.campId} onValueChange={(v) => setForm({ ...form, campId: v })} required>
                  <SelectTrigger><SelectValue placeholder="Select camp" /></SelectTrigger>
                  <SelectContent>
                    {camps.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={form.ownerId} onValueChange={(v) => setForm({ ...form, ownerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Default (you)" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sire</Label>
                <Select value={form.sireId} onValueChange={(v) => setForm({ ...form, sireId: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {animals.filter((a) => a.eartag.startsWith("BULL") || true).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.eartag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dam</Label>
                <Select value={form.damId} onValueChange={(v) => setForm({ ...form, damId: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {animals.map((a) => <SelectItem key={a.id} value={a.id}>{a.eartag}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo">Photo</Label>
              <Input id="photo" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="colorMarkings">Color / Markings</Label>
              <Input id="colorMarkings" value={form.colorMarkings} onChange={(e) => setForm({ ...form, colorMarkings: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Register Animal"}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    
  );
}
