"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Pencil, Plus, StickyNote } from "lucide-react";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { useLocale, useT } from "@/components/providers/locale-provider";
import { TAG_COLORS, tagColorLabel } from "@/lib/tag-color";
import { TagColorSwatch } from "@/components/eartag-badge";
import {
  CampPhotoGallery,
  type CampPhoto,
} from "@/components/camp-photo-gallery";
import { OptionalSection } from "@/components/optional-section";
import {
  DEFAULT_PAGE_SIZE,
  ListPagination,
} from "@/components/list-pagination";

const CampLocationPicker = dynamic(
  () =>
    import("@/components/camp-location-picker").then((m) => m.CampLocationPicker),
  { ssr: false }
);

interface CampDetail {
  id: string;
  name: string;
  code?: string | null;
  tagColor?: string | null;
  legacyCode?: string | null;
  latitude: number | null;
  longitude: number | null;
  sizeAcres: number | null;
  logoUrl: string | null;
  waterSources: string | null;
  notes: string | null;
  isActive?: boolean;
  animals: {
    id: string;
    eartag: string;
    breed: string;
    sex: string;
    ageMonths: number | null;
  }[];
  animalTotal?: number;
  animalsLimit?: number;
  animalsOffset?: number;
  animalsHasMore?: boolean;
  bySex?: Record<string, number>;
  _count?: { animals: number };
  assignments: { user: { name: string; role: string } }[];
  photos: CampPhoto[];
}

export default function CampDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageCamps") : false;
  const canRegister = role ? hasPermission(role, "createAnimal") : false;

  const [camp, setCamp] = useState<CampDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [animalsLoading, setAnimalsLoading] = useState(false);
  const [animalsOffset, setAnimalsOffset] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    sizeAcres: "",
    latitude: "",
    longitude: "",
    waterSources: "",
    notes: "",
    tagColor: "",
  });

  const load = useCallback(
    async (offset = 0, opts?: { soft?: boolean }) => {
      if (opts?.soft) setAnimalsLoading(true);
      else setLoading(true);
      const params = new URLSearchParams({
        limit: String(DEFAULT_PAGE_SIZE),
        offset: String(offset),
      });
      const res = await fetch(`/api/camps/${id}?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCamp(data);
        setAnimalsOffset(offset);
        if (!opts?.soft) {
          setForm({
            name: data.name || "",
            code: data.code || "",
            sizeAcres: data.sizeAcres != null ? String(data.sizeAcres) : "",
            latitude: data.latitude != null ? String(data.latitude) : "",
            longitude: data.longitude != null ? String(data.longitude) : "",
            waterSources: data.waterSources || "",
            notes: data.notes || "",
            tagColor: data.tagColor || "",
          });
          setShowNotes(Boolean(data.notes?.trim()));
        }
      }
      setLoading(false);
      setAnimalsLoading(false);
    },
    [id]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  async function saveDetails() {
    setSaving(true);
    const res = await fetch(`/api/camps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        code: form.code.trim() || null,
        sizeAcres: form.sizeAcres || null,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
        waterSources: form.waterSources || null,
        notes: form.notes || null,
        tagColor: form.tagColor || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToSave"));
      return;
    }
    setEditing(false);
    setShowNotes(Boolean(form.notes.trim()));
    load(animalsOffset, { soft: true });
  }

  async function toggleActive() {
    const next = !(camp?.isActive !== false);
    if (!next && !window.confirm(t("confirmDeactivateCamp"))) return;
    setSaving(true);
    const res = await fetch(`/api/camps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToSave"));
      return;
    }
    load(animalsOffset, { soft: true });
  }

  async function softDeleteCamp() {
    if (!window.confirm(t("confirmSoftDeleteCamp"))) return;
    setSaving(true);
    const res = await fetch(`/api/camps/${id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToDelete"));
      return;
    }
    router.push("/camps");
  }

  if (loading) {
    return <p className="text-muted-foreground">{t("loading")}</p>;
  }
  if (!camp) {
    return <p className="text-muted-foreground">{t("noResults")}</p>;
  }

  const animalTotal =
    camp.animalTotal ?? camp._count?.animals ?? camp.animals.length;
  const bySex = camp.bySex ?? {};
  const sexLine = [
    bySex.MALE ? `${bySex.MALE} ${t("male")}` : null,
    bySex.FEMALE ? `${bySex.FEMALE} ${t("female")}` : null,
    bySex.UNKNOWN ? `${bySex.UNKNOWN} ${t("unknownSex")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const hasNotes = Boolean(camp.notes?.trim());
  const registerHref = `/animals/new?camp=${camp.id}`;

  return (
    <div className="space-y-6">
      <Link
        href="/camps"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> {t("navCamps")}
      </Link>

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
              <Label>{t("campCode")}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="MR-01"
                className="font-mono"
              />
              <p className="text-sm text-muted-foreground">{t("campCodeHelp")}</p>
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
              <Label>{t("tagColorCamp")}</Label>
              <Select
                value={form.tagColor || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, tagColor: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("tagColorUseDefault")}</SelectItem>
                  {TAG_COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {tagColorLabel(c, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{t("tagColorHelp")}</p>
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
        <>
          <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-muted/60 via-background to-background">
            <div className="absolute inset-x-0 top-0 h-1 bg-foreground/10" />
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                  {camp.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={camp.logoUrl}
                      alt=""
                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border object-cover shrink-0 shadow-sm"
                    />
                  ) : (
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border bg-muted/80 shrink-0 flex items-center justify-center text-lg font-semibold text-muted-foreground">
                      {(camp.code || camp.name).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 space-y-1">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight truncate">
                      {camp.name}
                    </h1>
                    {camp.code && (
                      <p className="text-base sm:text-lg font-mono text-muted-foreground tracking-wide">
                        {camp.code}
                      </p>
                    )}
                    {camp.isActive === false && (
                      <Badge variant="secondary">{t("campInactive")}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {canRegister && camp.isActive !== false && (
                    <Button asChild>
                      <Link href={registerHref}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t("registerAnimal")}
                      </Link>
                    </Button>
                  )}
                  {canManage && (
                    <Button variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      {t("editDetails")}
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      variant="outline"
                      disabled={saving}
                      onClick={toggleActive}
                    >
                      {camp.isActive === false
                        ? t("activateCamp")
                        : t("deactivateCamp")}
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      variant="destructive"
                      disabled={saving}
                      onClick={softDeleteCamp}
                    >
                      {t("moveToTrash")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-lg font-semibold tabular-nums">
                  {animalTotal}{" "}
                  <span className="font-medium text-muted-foreground">
                    {t("activeAnimals").toLowerCase()}
                  </span>
                </p>
                {sexLine && (
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {sexLine}
                  </p>
                )}
                {camp.tagColor && (
                  <TagColorSwatch
                    color={camp.tagColor}
                    locale={locale}
                    className="pt-0.5"
                  />
                )}
              </div>

              {(camp.sizeAcres != null ||
                camp.waterSources ||
                camp.assignments.length > 0) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground border-t pt-4">
                  {camp.sizeAcres != null && (
                    <span>
                      {camp.sizeAcres} {t("acres")}
                    </span>
                  )}
                  {camp.waterSources && (
                    <span>
                      {t("waterSources")}: {camp.waterSources}
                    </span>
                  )}
                  {camp.assignments.length > 0 && (
                    <span>
                      {t("supervisor")}:{" "}
                      {camp.assignments.map((a) => a.user.name).join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          <OptionalSection
            open={showNotes}
            onToggle={() => setShowNotes((v) => !v)}
            title={t("campNotes")}
            summary={
              hasNotes
                ? camp.notes!.trim().slice(0, 80) +
                  (camp.notes!.trim().length > 80 ? "…" : "")
                : t("noCampNotes")
            }
          >
            {hasNotes ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {camp.notes}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <StickyNote className="h-4 w-4 shrink-0" />
                {canManage ? t("noCampNotesEditHint") : t("noCampNotes")}
              </p>
            )}
          </OptionalSection>
        </>
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
          onPhotosChange={() => load(animalsOffset, { soft: true })}
          onLogoChange={(url) =>
            setCamp((c) => (c ? { ...c, logoUrl: url } : c))
          }
        />
      </OptionalSection>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold">
            {t("animalsInCamp")}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              ({animalTotal})
            </span>
          </h2>
          {canRegister && (
            <Button asChild variant="outline" size="sm">
              <Link href={registerHref}>
                <Plus className="h-4 w-4 mr-2" />
                {t("registerAnimal")}
              </Link>
            </Button>
          )}
        </div>
        {animalTotal === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
            <p className="text-muted-foreground text-sm">{t("noAnimalsInCamp")}</p>
            {canRegister && (
              <Button asChild>
                <Link href={registerHref}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("registerAnimal")}
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-xl border overflow-hidden">
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
                          {animal.sex === "MALE"
                            ? t("male")
                            : animal.sex === "FEMALE"
                              ? t("female")
                              : t("unknownSex")}
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
            <ListPagination
              total={animalTotal}
              limit={DEFAULT_PAGE_SIZE}
              offset={animalsOffset}
              loading={animalsLoading}
              onPrev={() =>
                load(Math.max(0, animalsOffset - DEFAULT_PAGE_SIZE), {
                  soft: true,
                })
              }
              onNext={() =>
                load(animalsOffset + DEFAULT_PAGE_SIZE, { soft: true })
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
