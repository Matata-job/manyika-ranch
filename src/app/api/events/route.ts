import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildAnimalScope } from "@/lib/auth/api-guard";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewAnimal");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");
  const type = searchParams.get("type");
  const take = Math.min(parseInt(searchParams.get("limit") || "100", 10), 300);

  const animalScope = await buildAnimalScope(result.user.id, result.user.role as Role, {
    campId,
  });
  if ("error" in animalScope) return animalScope.error;

  const events = await prisma.animalEvent.findMany({
    where: {
      animal: animalScope,
      ...(type ? { type: type as "NOTE" } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take,
    include: {
      animal: {
        select: {
          id: true,
          eartag: true,
          camp: { select: { name: true } },
        },
      },
      recordedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(events);
}
