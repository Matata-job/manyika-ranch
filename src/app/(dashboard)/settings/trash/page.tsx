"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/providers/locale-provider";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";

type TrashAnimal = {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  status: string;
  campName: string;
  deletedAt: string;
  daysLeft: number;
};

type TrashCamp = {
  id: string;
  name: string;
  code: string | null;
  deletedAt: string;
  daysLeft: number;
};

export default function RecentlyDeletedPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canDeleteAnimal = role ? hasPermission(role, "deleteAnimal") : false;
  const canManageCamps = role ? hasPermission(role, "manageCamps") : false;

  const [animals, setAnimals] = useState<TrashAnimal[]>([]);
  const [camps, setCamps] = useState<TrashCamp[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/trash");
    if (res.ok) {
      const data = await res.json();
      setAnimals(data.animals || []);
      setCamps(data.camps || []);
      setRetentionDays(data.retentionDays ?? 30);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function restoreAnimal(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/animals/${id}/restore`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("restoreFailed"));
      return;
    }
    load();
  }

  async function restoreCamp(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/camps/${id}/restore`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("restoreFailed"));
      return;
    }
    load();
  }

  async function permanentDelete(type: "animal" | "camp", id: string) {
    if (!window.confirm(t("confirmPermanentDelete"))) return;
    setBusyId(id);
    const res = await fetch(`/api/trash?type=${type}&id=${id}`, {
      method: "DELETE",
    });
    setBusyId(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("deleteFailed"));
      return;
    }
    load();
  }

  if (!canDeleteAnimal && !canManageCamps) {
    return (
      <p className="text-sm text-muted-foreground">{t("noPermission")}</p>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/settings/ranch"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("navSettings")}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          {t("recentlyDeletedTitle")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("recentlyDeletedHelp", { days: retentionDays })}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (
        <>
          {canDeleteAnimal && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("deletedAnimals")} ({animals.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {animals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("trashEmptyAnimals")}
                  </p>
                ) : (
                  animals.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{a.eartag}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.breed} · {a.campName} · {a.status}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("deletedOn")}: {formatDate(a.deletedAt)} ·{" "}
                          {t("daysLeftInTrash", { n: a.daysLeft })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === a.id}
                          onClick={() => restoreAnimal(a.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          {t("restore")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyId === a.id}
                          onClick={() => permanentDelete("animal", a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {t("deleteForever")}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {canManageCamps && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("deletedCamps")} ({camps.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {camps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("trashEmptyCamps")}
                  </p>
                ) : (
                  camps.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {c.name}
                          {c.code ? (
                            <Badge variant="outline" className="ml-2 font-normal">
                              {c.code}
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("deletedOn")}: {formatDate(c.deletedAt)} ·{" "}
                          {t("daysLeftInTrash", { n: c.daysLeft })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === c.id}
                          onClick={() => restoreCamp(c.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          {t("restore")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyId === c.id}
                          onClick={() => permanentDelete("camp", c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {t("deleteForever")}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
