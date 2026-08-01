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

export default function AlertsPage() {
  const t = useT();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  async function loadAlerts() {
    await fetch("/api/health/sync-alerts", { method: "POST" }).catch(() => null);
    const res = await fetch("/api/alerts");
    if (res.ok) setAlerts(await res.json());
  }

  useEffect(() => { loadAlerts(); }, []);

  async function resolveAlert(id: string) {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "RESOLVED" }),
    });
    loadAlerts();
  }

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("alertsTitle")}</h1>
          <p className="text-muted-foreground">{t("alertsSubtitle")}</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Pending Alerts</CardTitle></CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noAlerts")}</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between border-b pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            alert.type === "VACCINATION_DUE" ||
                            alert.type === "TREATMENT_DUE"
                              ? "warning"
                              : "secondary"
                          }
                        >
                          {alert.type.replace(/_/g, " ")}
                        </Badge>
                        <span className="font-medium">{alert.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                      {alert.animal && (
                        <Link href={`/animals/${alert.animal.id}`} className="text-sm text-primary hover:underline">
                          View {alert.animal.eartag}
                        </Link>
                      )}
                      {alert.dueDate && (
                        <p className="text-xs text-muted-foreground mt-1">Due: {formatDate(alert.dueDate)}</p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>
                      {t("markResolved")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    
  );
}
