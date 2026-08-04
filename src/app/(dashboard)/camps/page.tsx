import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { MapPin, Plus, Users } from "lucide-react";
import { hasPermission } from "@/lib/auth/rbac";
import { getScopedCampWhere } from "@/lib/auth/scope";
import type { Role } from "@prisma/client";
import { serverT } from "@/lib/i18n/server";
import { TagColorSwatch } from "@/components/eartag-badge";
import { cn } from "@/lib/utils";

function campInitials(name: string, code: string | null): string {
  if (code?.trim()) {
    const parts = code.trim().split(/[-_\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1].slice(0, 2))
        .toUpperCase()
        .slice(0, 3);
    }
    return code.trim().slice(0, 3).toUpperCase();
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {camps.map((camp) => {
            const coverUrl = camp.logoUrl || camp.photos[0]?.url || null;
            const supervisors = camp.assignments.map((a) => a.user.name);
            const initials = campInitials(camp.name, camp.code);

            return (
              <Link
                key={camp.id}
                href={`/camps/${camp.id}`}
                className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
              >
                <article
                  className={cn(
                    "flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all",
                    "hover:border-foreground/20 hover:shadow-md",
                    !camp.isActive && "opacity-75"
                  )}
                >
                  {/* Visual header: logo / photo / monogram */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-stone-200 dark:bg-stone-800">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-300 via-amber-100/80 to-stone-400 dark:from-stone-700 dark:via-amber-950/40 dark:to-stone-900"
                        aria-hidden
                      >
                        <span className="select-none text-4xl font-bold tracking-wide text-stone-700/70 dark:text-stone-200/70 sm:text-5xl">
                          {initials}
                        </span>
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      {camp.code && (
                        <span className="rounded-md bg-background/95 px-2 py-0.5 text-xs font-semibold tracking-wide text-foreground shadow-sm backdrop-blur-sm">
                          {camp.code}
                        </span>
                      )}
                      {!camp.isActive && (
                        <Badge
                          variant="secondary"
                          className="bg-background/90 font-normal shadow-sm"
                        >
                          {t("campInactive")}
                        </Badge>
                      )}
                    </div>

                    {camp._count.photos > 0 && (
                      <span className="absolute bottom-3 right-3 rounded-md bg-black/55 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
                        {t("photoCount", { n: camp._count.photos })}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="min-w-0">
                      <h2
                        className={cn(
                          "truncate text-lg font-semibold leading-tight tracking-tight",
                          !camp.isActive && "text-muted-foreground"
                        )}
                      >
                        {camp.name}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xl font-bold tabular-nums leading-none">
                          {camp._count.animals}
                        </span>
                        <span className="text-muted-foreground">
                          {t("animalsTitle").toLowerCase()}
                        </span>
                      </span>
                      {camp.sizeAcres != null && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {camp.sizeAcres} {t("acres")}
                        </span>
                      )}
                    </div>

                    {camp.tagColor && (
                      <TagColorSwatch color={camp.tagColor} locale={locale} />
                    )}

                    {supervisors.length > 0 ? (
                      <p className="mt-auto border-t pt-3 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground/80">
                          {t("supervisor")}
                        </span>
                        <span className="mx-1.5 text-border">·</span>
                        <span className="text-foreground/90">
                          {supervisors.join(", ")}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-auto border-t pt-3 text-sm text-muted-foreground/70">
                        {t("noSupervisorAssigned")}
                      </p>
                    )}
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
