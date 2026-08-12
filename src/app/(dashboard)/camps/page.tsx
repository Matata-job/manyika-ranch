import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { hasPermission } from "@/lib/auth/rbac";
import { getScopedCampWhere } from "@/lib/auth/scope";
import { buildCampAnimalCountWhere } from "@/lib/auth/api-guard";
import type { Role } from "@prisma/client";
import { serverT } from "@/lib/i18n/server";
import {
  CampsDirectory,
  type CampListItem,
} from "@/components/camps-directory";

export default async function CampsPage() {
  const { t, locale } = await serverT();
  const session = await auth();
  const user = session!.user;
  const role = user.role as Role;
  const canManage = hasPermission(role, "manageCamps");

  const campWhere = await getScopedCampWhere(user.id, role, user.ranchId);
  const animalCountWhere = buildCampAnimalCountWhere(user.id, role);

  const camps = await prisma.camp.findMany({
    where: campWhere,
    include: {
      _count: {
        select: {
          animals: { where: animalCountWhere },
          photos: true,
        },
      },
      assignments: { include: { user: { select: { name: true } } } },
      photos: {
        take: 1,
        orderBy: { takenAt: "desc" },
        select: { url: true },
      },
    },
    orderBy: [{ isActive: "desc" }, { code: "asc" }, { name: "asc" }],
  });

  const items: CampListItem[] = camps.map((camp) => ({
    id: camp.id,
    name: camp.name,
    code: camp.code,
    tagColor: camp.tagColor,
    sizeAcres: camp.sizeAcres,
    isActive: camp.isActive,
    logoUrl: camp.logoUrl,
    coverUrl: camp.photos[0]?.url ?? null,
    photoCount: camp._count.photos,
    animalCount: camp._count.animals,
    supervisors: camp.assignments.map((a) => a.user.name),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            {t("campsTitle")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t("campsSubtitle")}</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("campsListHelp")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("campsListCount", { n: camps.length })}
            {role === "CAMP_SUPERVISOR"
              ? ` · ${t("campsAssignedToYou")}`
              : ` · ${t("campsAcrossRanch")}`}
          </p>
        </div>
        {canManage && (
          <Link href="/camps/new">
            <Button className="bg-foreground text-background hover:bg-foreground/90">
              <Plus className="mr-2 h-4 w-4" />
              {t("addCamp")}
            </Button>
          </Link>
        )}
      </div>

      {camps.length === 0 ? (
        <p className="text-muted-foreground">{t("noCamps")}</p>
      ) : (
        <CampsDirectory camps={items} locale={locale} />
      )}
    </div>
  );
}
