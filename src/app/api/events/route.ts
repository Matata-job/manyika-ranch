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
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
    300
  );
  const offset = Math.max(
    parseInt(searchParams.get("offset") || "0", 10) || 0,
    0
  );

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

  const where = {
    animal: animalScope,
    ...(type ? { type: type as AnimalEventType } : {}),
    ...(occurredAt ? { occurredAt } : {}),
  };

  const [events, total] = await Promise.all([
    prisma.animalEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: limit,
      skip: offset,
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
    }),
    prisma.animalEvent.count({ where }),
  ]);

  return NextResponse.json({
    events,
    total,
    limit,
    offset,
    hasMore: offset + events.length < total,
  });
}
