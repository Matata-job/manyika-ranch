import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus } from "lucide-react";
import { hasPermission } from "@/lib/auth/rbac";
import { getScopedCampWhere } from "@/lib/auth/scope";
import type { Role } from "@prisma/client";
import { serverT } from "@/lib/i18n/server";
import { TagColorSwatch } from "@/components/eartag-badge";

export default async function CampsPage() {
  const { t, locale } = await serverT();
  const session = await auth();
  const user = session!.user;
  const role = user.role as Role;
  const canManage = hasPermission(role, "manageCamps");

  const campWhere = await getScopedCampWhere(user.id, role, user.ranchId);

  const camps = await prisma.camp.findMany({
    where: campWhere,
    include: {
      _count: {
        select: {
          animals: { where: { status: "ACTIVE", deletedAt: null } },
        },
      },
      assignments: { include: { user: { select: { name: true } } } },
    },
    orderBy: [{ isActive: "desc" }, { code: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            {t("campsTitle")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("campsSubtitle")}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("campsListHelp")}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {camps.length} camp{camps.length === 1 ? "" : "s"}
            {role === "CAMP_SUPERVISOR" ? " assigned to you" : " across the ranch"}
          </p>
        </div>
        {canManage && (
          <Link href="/camps/new">
            <Button className="bg-foreground text-background hover:bg-foreground/90">
              <Plus className="h-4 w-4 mr-2" />
              {t("addCamp")}
            </Button>
          </Link>
        )}
      </div>

      {camps.length === 0 ? (
        <p className="text-muted-foreground">{t("noCamps")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {camps.map((camp) => (
            <Link key={camp.id} href={`/camps/${camp.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-baseline gap-2">
                    <span className={!camp.isActive ? "text-muted-foreground" : undefined}>
                      {camp.name}
                    </span>
                    {camp.code && (
                      <span className="text-sm font-normal text-muted-foreground">
                        {camp.code}
                      </span>
                    )}
                    {!camp.isActive && (
                      <Badge variant="secondary" className="font-normal">
                        {t("campInactive")}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-bold">{camp._count.animals} {t("animalsTitle").toLowerCase()}</p>
                  {camp.tagColor && (
                    <TagColorSwatch color={camp.tagColor} locale={locale} />
                  )}
                  {camp.sizeAcres != null && (
                    <p className="text-sm text-muted-foreground">
                      {camp.sizeAcres} {t("acres")}
                    </p>
                  )}
                  {camp.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={camp.logoUrl}
                      alt=""
                      className="mt-2 h-10 w-10 rounded object-cover border"
                    />
                  )}
                  {camp.assignments.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t("supervisor")}: {camp.assignments.map((a) => a.user.name).join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
