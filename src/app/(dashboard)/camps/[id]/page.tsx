import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { userCanAccessCamp, getScopedAnimalWhere } from "@/lib/auth/scope";
import type { Role } from "@prisma/client";

export default async function CampDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const allowed = await userCanAccessCamp(session.user.id, role, id);
  if (!allowed) notFound();

  const animalWhere = await getScopedAnimalWhere(session.user.id, role, {
    campId: id,
  });

  const camp = await prisma.camp.findUnique({
    where: { id },
    include: {
      animals: {
        where: { status: "ACTIVE", ...animalWhere },
        select: { id: true, eartag: true, breed: true, sex: true, ageMonths: true },
        orderBy: { eartag: "asc" },
      },
      assignments: { include: { user: { select: { name: true, role: true } } } },
    },
  });

  if (!camp) notFound();

  const bySex = camp.animals.reduce(
    (acc, a) => {
      acc[a.sex] = (acc[a.sex] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{camp.name}</h1>
        <p className="text-muted-foreground">
          {camp.animals.length} active animals
          {camp.capacity && ` · Capacity ${camp.capacity}`}
          {role === "CAMP_SUPERVISOR" && " · Your assigned camp"}
          {role === "EXTERNAL_OWNER" && " · Your animals only"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Male</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{bySex.MALE || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Female</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{bySex.FEMALE || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Water Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{camp.waterSources || "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Animals in Camp</h2>
        {camp.animals.length === 0 ? (
          <p className="text-muted-foreground text-sm">No animals visible for your role.</p>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">Eartag</th>
                  <th className="p-3 text-left">Breed</th>
                  <th className="p-3 text-left">Sex</th>
                  <th className="p-3 text-left">Age (mo)</th>
                </tr>
              </thead>
              <tbody>
                {camp.animals.map((animal) => (
                  <tr key={animal.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <Link
                        href={`/animals/${animal.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {animal.eartag}
                      </Link>
                    </td>
                    <td className="p-3">{animal.breed}</td>
                    <td className="p-3">
                      <Badge variant="secondary">{animal.sex}</Badge>
                    </td>
                    <td className="p-3">{animal.ageMonths != null ? `${Math.floor(animal.ageMonths / 12)}y ${animal.ageMonths % 12}mo` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
