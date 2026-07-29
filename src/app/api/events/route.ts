import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildAnimalScope } from "@/lib/auth/api-guard";
import type { AnimalEventType, Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewAnimal");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");
  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const month = searchParams.get("month"); // YYYY-MM
  const take = Math.min(parseInt(searchParams.get("limit") || "100", 10), 300);

  const animalScope = await buildAnimalScope(result.user.id, result.user.role as Role, {
    campId,
  });
  if ("error" in animalScope) return animalScope.error;

  let occurredAt: { gte?: Date; lte?: Date } | undefined;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    occurredAt = {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
    };
  } else if (from || to) {
    occurredAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
  }

  const events = await prisma.animalEvent.findMany({
    where: {
      animal: animalScope,
      ...(type ? { type: type as AnimalEventType } : {}),
      ...(occurredAt ? { occurredAt } : {}),
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
