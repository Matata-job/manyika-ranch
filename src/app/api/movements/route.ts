import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildMovementScope } from "@/lib/auth/api-guard";
import type { Role } from "@prisma/client";

export async function GET() {
  const result = await requirePermission("manageMovements");
  if (!result.ok) return result.error;

  const movementScope = await buildMovementScope(
    result.user.id,
    result.user.role as Role
  );
  if ("error" in movementScope) return movementScope.error;

  const movements = await prisma.movement.findMany({
    where: movementScope,
    orderBy: { date: "desc" },
    take: 100,
    include: {
      animal: { select: { id: true, eartag: true } },
      fromCamp: { select: { name: true } },
      toCamp: { select: { name: true } },
      authorizedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(movements);
}
