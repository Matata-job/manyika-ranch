"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { ArrowLeft, Camera, Save } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  nationalId: string | null;
  photoUrl: string | null;
  address: string | null;
  nextOfKin: string | null;
  isActive: boolean;
  createdAt: string;
  campAssignments: { camp: { id: string; name: string } }[];
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    nationalId: "",
    address: "",
    nextOfKin: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadUser() {
    const res = await fetch(`/api/users/${id}`);
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      setForm({
        name: data.name || "",
        phone: data.phone || "",
        nationalId: data.nationalId || "",
        address: data.address || "",
        nextOfKin: data.nextOfKin || "",
      });
    }
  }

  useEffect(() => { loadUser(); }, [id]);

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile) return null;
    const fd = new FormData();
    fd.append("file", photoFile);
    fd.append("folder", "users");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
  }

  async function handleSave() {
    setSaving(true);
    let photoUrl: string | undefined;
    if (photoFile) {
      const url = await uploadPhoto();
      if (url) photoUrl = url;
    }

    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ...(photoUrl !== undefined ? { photoUrl } : {}),
      }),
    });

    setSaving(false);
    setEditing(false);
    setPhotoFile(null);
    loadUser();
  }

  if (!user) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/settings/users" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to users
      </Link>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="shrink-0">
          <div className="w-36 h-36 rounded-full bg-muted flex items-center justify-center overflow-hidden border-4 border-background shadow-lg">
            {user.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-muted-foreground">
                {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </span>
            )}
          </div>
          {editing && (
            <div className="mt-3">
              <Label htmlFor="photo" className="cursor-pointer inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <Camera className="h-4 w-4" /> Change photo
              </Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              />
              {photoFile && <p className="text-xs text-muted-foreground mt-1">{photoFile.name}</p>}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-3xl font-bold">{user.name}</h1>
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
            <Badge variant={user.isActive ? "success" : "destructive"}>
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-muted-foreground">{user.email}</p>
          {user.campAssignments.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Camps: {user.campAssignments.map((a) => a.camp.name).join(", ")}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Joined {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile Details</CardTitle>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setPhotoFile(null); }}>Cancel</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+255 xxx xxx xxx" />
              </div>
              <div className="space-y-2">
                <Label>National ID</Label>
                <Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="ID number" />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Village, District" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Next of Kin</Label>
                <Input value={form.nextOfKin} onChange={(e) => setForm({ ...form, nextOfKin: e.target.value })} placeholder="Name — Phone" />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{user.phone || "—"}</p></div>
              <div><span className="text-muted-foreground">National ID</span><p className="font-medium">{user.nationalId || "—"}</p></div>
              <div><span className="text-muted-foreground">Address</span><p className="font-medium">{user.address || "—"}</p></div>
              <div><span className="text-muted-foreground">Next of Kin</span><p className="font-medium">{user.nextOfKin || "—"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
