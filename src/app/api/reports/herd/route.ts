import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildAnimalScope } from "@/lib/auth/api-guard";
import { ageGroupWhere } from "@/lib/reports/age-filter";
import { prismaDateRange } from "@/lib/reports/date-range";
import { withComputedAge } from "@/lib/services/animal-service";
import type { AnimalStatus, Prisma, Role } from "@prisma/client";

/**
 * Herd report: animals filtered by camp, age group, status, and optional
 * date range (acquisition date, else DOB).
 */
export async function GET(req: NextRequest) {
  const result = await requirePermission("viewReports");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");
  const ageGroup = searchParams.get("ageGroup");
  const status = searchParams.get("status") || "ACTIVE";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const scope = await buildAnimalScope(result.user.id, result.user.role as Role, {
    campId: campId && campId !== "all" ? campId : null,
  });
  if ("error" in scope) return scope.error;

  const ageWhere = ageGroupWhere(ageGroup);
  const range = prismaDateRange(from, to);

  const andParts: Prisma.AnimalWhereInput[] = [
    ...(ageWhere ? [ageWhere] : []),
    ...(range
      ? [
          {
            OR: [
              { acquisitionDate: range },
              {
                AND: [{ acquisitionDate: null }, { dob: range }],
              },
            ],
          } satisfies Prisma.AnimalWhereInput,
        ]
      : []),
  ];

  const where: Prisma.AnimalWhereInput = {
    ...scope,
    ...(status && status !== "ALL" ? { status: status as AnimalStatus } : {}),
    ...(andParts.length ? { AND: andParts } : {}),
  };

  const animals = await prisma.animal.findMany({
    where,
    select: {
      id: true,
      eartag: true,
      breed: true,
      sex: true,
      status: true,
      dob: true,
      ageMonths: true,
      isCastrated: true,
      isPregnant: true,
      acquisitionType: true,
      acquisitionDate: true,
      colorMarkings: true,
      notes: true,
      camp: { select: { id: true, name: true, code: true } },
      owner: { select: { id: true, name: true } },
      sire: { select: { eartag: true } },
      dam: { select: { eartag: true } },
    },
    orderBy: [{ camp: { name: "asc" } }, { eartag: "asc" }],
    take: 5000,
  });

  const rows = animals.map((a) => withComputedAge(a));

  const byCamp: Record<string, number> = {};
  const bySex: Record<string, number> = {};
  const byBreed: Record<string, number> = {};
  const byAge: Record<string, number> = {
    calf: 0,
    yearling: 0,
    adult: 0,
    mature: 0,
    unknown: 0,
  };

  for (const a of rows) {
    byCamp[a.camp.name] = (byCamp[a.camp.name] || 0) + 1;
    bySex[a.sex] = (bySex[a.sex] || 0) + 1;
    byBreed[a.breed] = (byBreed[a.breed] || 0) + 1;
    const m = a.ageMonths;
    if (m == null) byAge.unknown += 1;
    else if (m < 12) byAge.calf += 1;
    else if (m < 24) byAge.yearling += 1;
    else if (m < 60) byAge.adult += 1;
    else byAge.mature += 1;
  }

  return NextResponse.json({
    summary: {
      total: rows.length,
      byCamp: Object.entries(byCamp)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      bySex: Object.entries(bySex).map(([name, count]) => ({ name, count })),
      byBreed: Object.entries(byBreed)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      byAge: Object.entries(byAge)
        .filter(([, count]) => count > 0)
        .map(([name, count]) => ({ name, count })),
    },
    animals: rows,
  });
}
