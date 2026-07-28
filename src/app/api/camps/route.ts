import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildCampScope } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewCamps");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const forMovement = searchParams.get("for") === "movement";

  // Movement destination picker: any ranch camp (id+name only) if user can manage movements
  if (forMovement && hasPermission(result.user.role as Role, "manageMovements")) {
    const camps = await prisma.camp.findMany({
      where: { ranchId: result.user.ranchId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(camps);
  }

  const where = await buildCampScope(
    result.user.id,
    result.user.role as Role,
    result.user.ranchId
  );

  const camps = await prisma.camp.findMany({
    where,
    include: {
      _count: { select: { animals: { where: { status: "ACTIVE" } } } },
      assignments: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(camps);
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageCamps");
  if (!result.ok) return result.error;

  const body = await req.json();
  const camp = await prisma.camp.create({
    data: {
      ranchId: result.user.ranchId,
      name: body.name,
      latitude: body.latitude,
      longitude: body.longitude,
      capacity: body.capacity,
      waterSources: body.waterSources,
      notes: body.notes,
    },
  });

  await createAuditLog(result.user.id, "CREATE", "Camp", camp.id, body);
  return NextResponse.json(camp, { status: 201 });
}
