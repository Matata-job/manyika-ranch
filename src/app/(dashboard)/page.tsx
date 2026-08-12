import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tent, Beef, HeartPulse, Bell } from "lucide-react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { getScopedCampWhere, getScopedAnimalWhere } from "@/lib/auth/scope";
import { buildCampAnimalCountWhere } from "@/lib/auth/api-guard";
import { hasPermission, isCampScopedRole } from "@/lib/auth/rbac";
import { serverT } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n/translations";
import { getHealthNotifyDaysEarly } from "@/lib/services/health-schedule";
import { syncAllRanchAlerts } from "@/lib/services/alert-sync";

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;
  const role = user.role as Role;
  const { t } = await serverT();

  const campWhere = await getScopedCampWhere(user.id, role, user.ranchId);
  const animalWhere = await getScopedAnimalWhere(user.id, role);
  const campAnimalCountWhere = buildCampAnimalCountWhere(user.id, role);

  // Keep vaccination/treatment due alerts fresh when staff open the dashboard
  await syncAllRanchAlerts(user.ranchId);

  const ranch = await prisma.ranch.findUnique({
    where: { id: user.ranchId },
    select: { settings: true },
  });
  const notifyDays = getHealthNotifyDaysEarly(ranch?.settings);
  const healthHorizon = new Date(Date.now() + notifyDays * 86400000);

  const [campCount, animalCount, vaccinationDue, treatmentDue, alertCount, camps] =
    await Promise.all([
      prisma.camp.count({ where: campWhere }),
      prisma.animal.count({
        where: { status: "ACTIVE", ...animalWhere },
      }),
      prisma.vaccination.count({
        where: {
          nextDue: { lte: healthHorizon, not: null },
          animal: { status: "ACTIVE", ...animalWhere },
        },
      }),
      prisma.treatment.count({
        where: {
          nextDue: { lte: healthHorizon, not: null },
          animal: { status: "ACTIVE", ...animalWhere },
        },
      }),
      prisma.alert.count({
        where: {
          status: "PENDING",
          ...(isCampScopedRole(role)
            ? {
                OR: [
                  { animal: animalWhere },
                  { animalId: null, type: "MEDICINE_LOW" },
                ],
              }
            : { OR: [{ animalId: null }, { animal: animalWhere }] }),
        },
      }),
      prisma.camp.findMany({
        where: campWhere,
        include: {
          _count: { select: { animals: { where: campAnimalCountWhere } } },
        },
        orderBy: { name: "asc" },
        take: 12,
      }),
    ]);

  const canViewReports = hasPermission(role, "viewReports");
  const healthDue = vaccinationDue + treatmentDue;

  const stats: {
    labelKey: TranslationKey;
    value: number;
    icon: typeof Tent;
    href: string;
    color: string;
  }[] = [
    { labelKey: "navCamps", value: campCount, icon: Tent, href: "/camps", color: "text-blue-600" },
    {
      labelKey: "activeAnimals",
      value: animalCount,
      icon: Beef,
      href: "/animals",
      color: "text-green-600",
    },
    ...(canViewReports
      ? [
          {
            labelKey: "vaccinationsDue" as const,
            value: healthDue,
            icon: HeartPulse,
            href: "/health",
            color: "text-amber-600",
          },
        ]
      : []),
    {
      labelKey: "pendingAlerts",
      value: alertCount,
      icon: Bell,
      href: "/alerts",
      color: "text-red-600",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboardTitle")}</h1>
          <p className="text-muted-foreground">{t("dashboardSubtitle")}</p>
        </div>
        <Link
          href="/activities"
          className="inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          {t("goToActivities")}
        </Link>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">{t("goToActivitiesHelp")}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.labelKey} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {t(stat.labelKey)}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">{t("campOverview")}</h2>
        {camps.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noCamps")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {camps.map((camp) => (
              <Link key={camp.id} href={`/camps/${camp.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{camp.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{camp._count.animals}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("activeAnimals")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
