import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildCampScope } from "@/lib/auth/api-guard";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewReports");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");

  let where = await buildCampScope(
    result.user.id,
    result.user.role as Role,
    result.user.ranchId
  );

  if (campId) {
    // Ensure requested camp is within scope
    const scoped = await prisma.camp.findFirst({
      where: { ...where, id: campId },
      select: { id: true },
    });
    if (!scoped) {
      return NextResponse.json({ error: "Forbidden: camp access denied" }, { status: 403 });
    }
    where = { ...where, id: campId };
  }

  const camps = await prisma.camp.findMany({
    where,
    include: {
      _count: { select: { animals: { where: { status: "ACTIVE" } } } },
      animals: {
        where: { status: "ACTIVE" },
        select: { sex: true, breed: true, ageMonths: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const inventory = camps.map((camp) => {
    const bySex = camp.animals.reduce(
      (acc, a) => {
        acc[a.sex] = (acc[a.sex] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const byBreed = camp.animals.reduce(
      (acc, a) => {
        acc[a.breed] = (acc[a.breed] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      id: camp.id,
      name: camp.name,
      capacity: camp.capacity,
      totalActive: camp._count.animals,
      bySex,
      byBreed,
    };
  });

  return NextResponse.json(inventory);
}
