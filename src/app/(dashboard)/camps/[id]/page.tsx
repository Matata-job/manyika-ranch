"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Pencil } from "lucide-react";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { useT } from "@/components/providers/locale-provider";
import {
  CampPhotoGallery,
  type CampPhoto,
} from "@/components/camp-photo-gallery";
import { OptionalSection } from "@/components/optional-section";

const CampLocationPicker = dynamic(
  () =>
    import("@/components/camp-location-picker").then((m) => m.CampLocationPicker),
  { ssr: false }
);

interface CampDetail {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  sizeAcres: number | null;
  logoUrl: string | null;
  waterSources: string | null;
  notes: string | null;
  animals: {
    id: string;
    eartag: string;
    breed: string;
    sex: string;
    ageMonths: number | null;
  }[];
  assignments: { user: { name: string; role: string } }[];
  photos: CampPhoto[];
}

export default function CampDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageCamps") : false;

  const [camp, setCamp] = useState<CampDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sizeAcres: "",
    latitude: "",
    longitude: "",
    waterSources: "",
    notes: "",
  });

  const load = useCallback(async () => {
    const res = await fetch(`/api/camps/${id}`);
    if (res.ok) {
      const data = await res.json();
      setCamp(data);
      setForm({
        name: data.name || "",
        sizeAcres: data.sizeAcres != null ? String(data.sizeAcres) : "",
        latitude: data.latitude != null ? String(data.latitude) : "",
        longitude: data.longitude != null ? String(data.longitude) : "",
        waterSources: data.waterSources || "",
        notes: data.notes || "",
      });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveDetails() {
    setSaving(true);
    const res = await fetch(`/api/camps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        sizeAcres: form.sizeAcres || null,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
        waterSources: form.waterSources || null,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToSave"));
      return;
    }
    setEditing(false);
    load();
  }

  if (loading) {
    return <p className="text-muted-foreground">{t("loading")}</p>;
  }
  if (!camp) {
    return <p className="text-muted-foreground">{t("noResults")}</p>;
  }

  const bySex = camp.animals.reduce(
    (acc, a) => {
      acc[a.sex] = (acc[a.sex] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <Link
        href="/camps"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> {t("navCamps")}
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {camp.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={camp.logoUrl}
              alt=""
              className="h-16 w-16 rounded-lg border object-cover"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold">{camp.name}</h1>
            <p className="text-muted-foreground">
              {camp.animals.length} {t("activeAnimals").toLowerCase()}
              {camp.sizeAcres != null &&
                ` · ${camp.sizeAcres} ${t("acres")}`}
            </p>
          </div>
        </div>
        {canManage && !editing && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            {t("editDetails")}
          </Button>
        )}
      </div>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("editDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("campName")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("sizeAcres")}</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={form.sizeAcres}
                onChange={(e) =>
                  setForm({ ...form, sizeAcres: e.target.value })
                }
              />
            </div>
            <OptionalSection
              open={showLocation}
              onToggle={() => setShowLocation((v) => !v)}
              title={t("campLocation")}
              summary={
                form.latitude && form.longitude
                  ? `${form.latitude}, ${form.longitude}`
                  : t("optionalTapToAdd")
              }
            >
              <CampLocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={({ latitude, longitude }) =>
                  setForm({ ...form, latitude, longitude })
                }
              />
            </OptionalSection>
            <div className="space-y-2">
              <Label>{t("waterSources")}</Label>
              <Input
                value={form.waterSources}
                onChange={(e) =>
                  setForm({ ...form, waterSources: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("notes")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveDetails} disabled={saving}>
                {saving ? t("saving") : t("save")}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                {t("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("male")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{bySex.MALE || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("female")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{bySex.FEMALE || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("sizeAcres")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {camp.sizeAcres != null ? camp.sizeAcres : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("waterSources")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{camp.waterSources || "—"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!editing && (
        <OptionalSection
          open={showLocation}
          onToggle={() => setShowLocation((v) => !v)}
          title={t("campLocation")}
          summary={
            camp.latitude != null && camp.longitude != null
              ? `${camp.latitude}, ${camp.longitude}`
              : t("noLocationSet")
          }
        >
          {camp.latitude != null && camp.longitude != null ? (
            <CampLocationPicker
              latitude={String(camp.latitude)}
              longitude={String(camp.longitude)}
              onChange={() => {}}
              disabled
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("noLocationSet")}</p>
          )}
        </OptionalSection>
      )}

      <OptionalSection
        open={showPhotos}
        onToggle={() => setShowPhotos((v) => !v)}
        title={t("campPhotos")}
        summary={
          (camp.photos?.length || 0) > 0
            ? t("photoCount", { n: camp.photos.length })
            : t("noCampPhotos")
        }
      >
        <CampPhotoGallery
          campId={camp.id}
          initialPhotos={camp.photos || []}
          logoUrl={camp.logoUrl}
          canEdit={canManage}
          onPhotosChange={load}
          onLogoChange={(url) =>
            setCamp((c) => (c ? { ...c, logoUrl: url } : c))
          }
        />
      </OptionalSection>

      <div>
        <h2 className="text-xl font-semibold mb-4">{t("animalsInCamp")}</h2>
        {camp.animals.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noAnimalsInCamp")}</p>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">{t("eartag")}</th>
                  <th className="p-3 text-left">{t("breed")}</th>
                  <th className="p-3 text-left">{t("sex")}</th>
                  <th className="p-3 text-left">{t("age")}</th>
                </tr>
              </thead>
              <tbody>
                {camp.animals.map((animal) => (
                  <tr key={animal.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <Link
                        href={`/animals/${animal.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {animal.eartag}
                      </Link>
                    </td>
                    <td className="p-3">{animal.breed}</td>
                    <td className="p-3">
                      <Badge variant="secondary">
                        {animal.sex === "MALE" ? t("male") : t("female")}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {animal.ageMonths != null
                        ? `${Math.floor(animal.ageMonths / 12)}y ${animal.ageMonths % 12}mo`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
