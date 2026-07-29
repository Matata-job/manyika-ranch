import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tent, Beef, HeartPulse, Bell } from "lucide-react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { getScopedCampWhere, getScopedAnimalWhere } from "@/lib/auth/scope";
import { hasPermission, isCampScopedRole } from "@/lib/auth/rbac";

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;
  const role = user.role as Role;

  const campWhere = await getScopedCampWhere(user.id, role, user.ranchId);
  const animalWhere = await getScopedAnimalWhere(user.id, role);

  const [campCount, animalCount, vaccinationDue, alertCount, camps] =
    await Promise.all([
      prisma.camp.count({ where: campWhere }),
      prisma.animal.count({
        where: { status: "ACTIVE", ...animalWhere },
      }),
      prisma.vaccination.count({
        where: {
          nextDue: { lte: new Date(Date.now() + 30 * 86400000) },
          animal: { status: "ACTIVE", ...animalWhere },
        },
      }),
      prisma.alert.count({
        where: {
          status: "PENDING",
          ...(isCampScopedRole(role)
            ? { animal: animalWhere }
            : { OR: [{ animalId: null }, { animal: animalWhere }] }),
        },
      }),
      prisma.camp.findMany({
        where: campWhere,
        include: {
          _count: { select: { animals: { where: { status: "ACTIVE" } } } },
        },
        orderBy: { name: "asc" },
        take: 12,
      }),
    ]);

  const canViewReports = hasPermission(role, "viewReports");

  const stats = [
    { label: "Camps", value: campCount, icon: Tent, href: "/camps", color: "text-blue-600" },
    { label: "Active Animals", value: animalCount, icon: Beef, href: "/animals", color: "text-green-600" },
    ...(canViewReports
      ? [
          {
            label: "Vaccinations Due",
            value: vaccinationDue,
            icon: HeartPulse,
            href: "/reports",
            color: "text-amber-600",
          },
        ]
      : []),
    { label: "Pending Alerts", value: alertCount, icon: Bell, href: "/alerts", color: "text-red-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Manyika Ranch — Singida, Tanzania</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
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
        <h2 className="text-xl font-semibold mb-4">Camp Overview</h2>
        {camps.length === 0 ? (
          <p className="text-muted-foreground text-sm">No camps assigned to your account.</p>
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
                    <p className="text-xs text-muted-foreground">active animals</p>
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
