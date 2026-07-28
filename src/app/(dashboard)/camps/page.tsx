import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { hasPermission } from "@/lib/auth/rbac";
import { getScopedCampWhere } from "@/lib/auth/scope";
import type { Role } from "@prisma/client";

export default async function CampsPage() {
  const session = await auth();
  const user = session!.user;
  const role = user.role as Role;
  const canManage = hasPermission(role, "manageCamps");

  const campWhere = await getScopedCampWhere(user.id, role, user.ranchId);

  const camps = await prisma.camp.findMany({
    where: campWhere,
    include: {
      _count: { select: { animals: { where: { status: "ACTIVE" } } } },
      assignments: { include: { user: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Camps</h1>
          <p className="text-muted-foreground">
            {camps.length} camp{camps.length === 1 ? "" : "s"}
            {role === "CAMP_SUPERVISOR" ? " assigned to you" : " across the ranch"}
          </p>
        </div>
        {canManage && (
          <Link href="/camps/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Camp
            </Button>
          </Link>
        )}
      </div>

      {camps.length === 0 ? (
        <p className="text-muted-foreground">No camps available for your role.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {camps.map((camp) => (
            <Link key={camp.id} href={`/camps/${camp.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <CardTitle>{camp.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-bold">{camp._count.animals} animals</p>
                  {camp.capacity && (
                    <p className="text-sm text-muted-foreground">Capacity: {camp.capacity}</p>
                  )}
                  {camp.assignments.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Supervisor: {camp.assignments.map((a) => a.user.name).join(", ")}
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
