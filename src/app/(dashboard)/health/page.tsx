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

interface CalendarItem {
  id: string;
  kind: "vaccination" | "treatment";
  label: string;
  type?: string;
  nextDue: string;
  daysUntil: number;
  status: "overdue" | "due_soon" | "upcoming";
  animal: { id: string; eartag: string; camp: { id: string; name: string } };
}

function DueList({
  items,
  emptyLabel,
  t,
}: {
  items: CalendarItem[];
  emptyLabel: string;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={`${item.kind}-${item.id}`}
          className="flex items-center justify-between border-b pb-2 gap-2"
        >
          <div className="min-w-0">
            <Link
              href={`/animals/${item.animal.id}`}
              className="font-medium text-primary hover:underline"
            >
              {item.animal.eartag}
            </Link>
            <p className="text-sm text-muted-foreground truncate">
              {item.kind === "vaccination" ? t("vaccination") : t("treatment")}
              {": "}
              {item.label}
              {item.type ? ` (${t(treatmentTypeKey(item.type))})` : ""}
              {" · "}
              {item.animal.camp.name}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge
              variant={
                item.status === "overdue"
                  ? "destructive"
                  : item.status === "due_soon"
                    ? "warning"
                    : "secondary"
              }
            >
              {formatDate(item.nextDue)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {item.daysUntil < 0
                ? t("daysOverdue", { n: Math.abs(item.daysUntil) })
                : item.daysUntil === 0
                  ? t("dueToday")
                  : t("dueInDays", { n: item.daysUntil })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
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
  const [overdue, setOverdue] = useState<CalendarItem[]>([]);
  const [dueSoon, setDueSoon] = useState<CalendarItem[]>([]);
  const [upcoming, setUpcoming] = useState<CalendarItem[]>([]);
  const [notifyDaysEarly, setNotifyDaysEarly] = useState(14);
  const [daysAhead, setDaysAhead] = useState(60);

  useEffect(() => {
    fetch("/api/health/vaccines")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setVaccines(Array.isArray(d) ? d : []));
    fetch("/api/health/treatment-schedules")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTreatmentSchedules(Array.isArray(d) ? d : []));
    fetch("/api/health/calendar?days=60")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setOverdue(Array.isArray(d.overdue) ? d.overdue : []);
        setDueSoon(Array.isArray(d.dueSoon) ? d.dueSoon : []);
        setUpcoming(Array.isArray(d.upcoming) ? d.upcoming : []);
        if (typeof d.notifyDaysEarly === "number") {
          setNotifyDaysEarly(d.notifyDaysEarly);
        }
        if (typeof d.daysAhead === "number") setDaysAhead(d.daysAhead);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("healthTitle")}</h1>
          <p className="text-muted-foreground">{t("healthSubtitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("healthCalendarHint", { notify: notifyDaysEarly, ahead: daysAhead })}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/health/schedules">
                <CalendarClock className="h-4 w-4 mr-2" />
                {t("manageSchedules")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/health/inventory">{t("medicineInventory")}</Link>
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
          <CardTitle>{t("healthOverdue")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DueList items={overdue} emptyLabel={t("noHealthOverdue")} t={t} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("healthDueSoon", { n: notifyDaysEarly })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DueList items={dueSoon} emptyLabel={t("noHealthDueSoon")} t={t} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("healthUpcoming", { n: daysAhead })}</CardTitle>
        </CardHeader>
        <CardContent>
          <DueList
            items={upcoming}
            emptyLabel={t("noHealthUpcoming")}
            t={t}
          />
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
