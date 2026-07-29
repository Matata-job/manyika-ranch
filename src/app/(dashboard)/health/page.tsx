"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { CalendarClock, Syringe } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translations";

function treatmentTypeKey(type: string): TranslationKey {
  switch (type) {
    case "DEWORMING":
      return "deworming";
    case "DIPPING":
      return "dipping";
    case "ANTIBIOTIC":
      return "antibiotic";
    default:
      return "other";
  }
}

interface Vaccine {
  id: string;
  name: string;
  intervalDays: number | null;
  description: string | null;
}

interface TreatmentSchedule {
  id: string;
  name: string;
  type: string;
  intervalDays: number | null;
}

interface DueVaccination {
  id: string;
  vaccineName: string;
  nextDue: string;
  animal: { id: string; eartag: string; camp: { name: string } };
}

interface DueTreatment {
  id: string;
  product: string;
  type: string;
  nextDue: string;
  animal: { id: string; eartag: string; camp: { name: string } };
}

export default function HealthPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageHealth") : false;

  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [treatmentSchedules, setTreatmentSchedules] = useState<
    TreatmentSchedule[]
  >([]);
  const [due, setDue] = useState<DueVaccination[]>([]);
  const [dueTreatments, setDueTreatments] = useState<DueTreatment[]>([]);

  useEffect(() => {
    fetch("/api/health/vaccines")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setVaccines(Array.isArray(d) ? d : []));
    fetch("/api/health/treatment-schedules")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTreatmentSchedules(Array.isArray(d) ? d : []));
    fetch("/api/reports/vaccination-due")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDue(Array.isArray(d) ? d : []));
    fetch("/api/reports/treatment-due")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDueTreatments(Array.isArray(d) ? d : []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("healthTitle")}</h1>
          <p className="text-muted-foreground">{t("healthSubtitle")}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/health/schedules">
                <CalendarClock className="h-4 w-4 mr-2" />
                {t("manageSchedules")}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/health/bulk-treatment">
                <Syringe className="h-4 w-4 mr-2" />
                {t("bulkTreatment")}
              </Link>
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("vaccinationsDue30")}</CardTitle>
        </CardHeader>
        <CardContent>
          {due.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("noVaccinationsDue")}
            </p>
          ) : (
            <div className="space-y-2">
              {due.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between border-b pb-2"
                >
                  <div>
                    <Link
                      href={`/animals/${v.animal.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {v.animal.eartag}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {v.vaccineName} · {v.animal.camp.name}
                    </p>
                  </div>
                  <Badge variant="warning">{formatDate(v.nextDue)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("treatmentsDue30")}</CardTitle>
        </CardHeader>
        <CardContent>
          {dueTreatments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("noTreatmentsDue")}
            </p>
          ) : (
            <div className="space-y-2">
              {dueTreatments.map((dt) => (
                <div
                  key={dt.id}
                  className="flex items-center justify-between border-b pb-2"
                >
                  <div>
                    <Link
                      href={`/animals/${dt.animal.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {dt.animal.eartag}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {dt.product} ({t(treatmentTypeKey(dt.type))}) ·{" "}
                      {dt.animal.camp.name}
                    </p>
                  </div>
                  <Badge variant="warning">{formatDate(dt.nextDue)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{t("vaccineCatalog")}</CardTitle>
            {canManage && (
              <Button asChild size="sm" variant="outline">
                <Link href="/health/schedules">{t("edit")}</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {vaccines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noVaccinesYet")}
                {canManage && (
                  <>
                    {" "}
                    <Link
                      href="/health/schedules"
                      className="text-primary hover:underline"
                    >
                      {t("addSchedules")}
                    </Link>
                  </>
                )}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {vaccines.map((v) => (
                  <div key={v.id} className="rounded-lg border p-4">
                    <h3 className="font-medium">{v.name}</h3>
                    {v.intervalDays && (
                      <p className="text-sm text-muted-foreground">
                        {t("everyNDays", { n: v.intervalDays })}
                      </p>
                    )}
                    {v.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {v.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{t("treatmentSchedules")}</CardTitle>
            {canManage && (
              <Button asChild size="sm" variant="outline">
                <Link href="/health/schedules">{t("edit")}</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {treatmentSchedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noTreatmentSchedulesYet")}
                {canManage && (
                  <>
                    {" "}
                    <Link
                      href="/health/schedules"
                      className="text-primary hover:underline"
                    >
                      {t("addSchedules")}
                    </Link>
                  </>
                )}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {treatmentSchedules.map((ts) => (
                  <div key={ts.id} className="rounded-lg border p-4">
                    <h3 className="font-medium">{ts.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t(treatmentTypeKey(ts.type))}
                      {ts.intervalDays
                        ? ` · ${t("everyNDays", { n: ts.intervalDays })}`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
