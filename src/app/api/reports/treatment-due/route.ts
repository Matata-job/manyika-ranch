import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildAnimalScope } from "@/lib/auth/api-guard";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewReports");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");

  const animalScope = await buildAnimalScope(
    result.user.id,
    result.user.role as Role,
    { campId }
  );
  if ("error" in animalScope) return animalScope.error;

  const due = await prisma.treatment.findMany({
    where: {
      nextDue: { lte: new Date(Date.now() + 30 * 86400000) },
      animal: {
        status: "ACTIVE",
        ...animalScope,
      },
    },
    include: {
      animal: {
        select: {
          id: true,
          eartag: true,
          camp: { select: { name: true } },
        },
      },
    },
    orderBy: { nextDue: "asc" },
  });

  return NextResponse.json(due);
}
