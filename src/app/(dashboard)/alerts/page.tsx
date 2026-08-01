"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { useT } from "@/components/providers/locale-provider";

interface Alert {
  id: string;
  type: string;
  status: string;
  title: string;
  message: string;
  dueDate: string | null;
  animal: { id: string; eartag: string } | null;
}

function alertBadgeVariant(type: string) {
  if (
    type === "VACCINATION_DUE" ||
    type === "TREATMENT_DUE" ||
    type === "MEDICINE_LOW" ||
    type === "WEIGHT_BELOW_TARGET" ||
    type === "MOVEMENT_PENDING"
  ) {
    return "warning" as const;
  }
  return "secondary" as const;
}

function movementIdFromTitle(title: string): string | null {
  const parts = title.split(" · ");
  if (parts.length < 2) return null;
  const id = parts[parts.length - 1]?.trim();
  return id || null;
}

export default function AlertsPage() {
  const t = useT();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAlerts() {
    setSyncing(true);
    try {
      await fetch("/api/health/sync-alerts", { method: "POST" }).catch(() => null);
      const res = await fetch("/api/alerts");
      if (res.ok) setAlerts(await res.json());
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  async function resolveAlert(id: string) {
    setBusyId(id);
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "RESOLVED" }),
    });
    setBusyId(null);
    loadAlerts();
  }

  async function completeMovement(alert: Alert) {
    const movementId = movementIdFromTitle(alert.title);
    if (!movementId) {
      await resolveAlert(alert.id);
      return;
    }
    setBusyId(alert.id);
    const res = await fetch(`/api/movements/${movementId}/complete`, {
      method: "POST",
    });
    setBusyId(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(
        typeof err.error === "string" ? err.error : t("failedToSave")
      );
      return;
    }
    loadAlerts();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("alertsTitle")}</h1>
          <p className="text-muted-foreground">{t("alertsSubtitle")}</p>
        </div>
        <Button variant="outline" onClick={loadAlerts} disabled={syncing}>
          {syncing ? t("saving") : t("refreshAlerts")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("pendingAlerts")}</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noAlerts")}</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between border-b pb-3 gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={alertBadgeVariant(item.type)}>
                        {item.type.replace(/_/g, " ")}
                      </Badge>
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.message}
                    </p>
                    {item.animal && (
                      <Link
                        href={`/animals/${item.animal.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {t("viewAnimal", { eartag: item.animal.eartag })}
                      </Link>
                    )}
                    {item.dueDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("due")}: {formatDate(item.dueDate)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {item.type === "MOVEMENT_PENDING" && (
                      <Button
                        size="sm"
                        onClick={() => completeMovement(item)}
                        disabled={busyId === item.id}
                      >
                        {t("completeMove")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveAlert(item.id)}
                      disabled={busyId === item.id}
                    >
                      {t("markResolved")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
