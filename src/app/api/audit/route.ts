import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("manageUsers");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const userId = searchParams.get("userId");
  const role = searchParams.get("role");
  const action = searchParams.get("action");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const take = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

  const logs = await prisma.auditLog.findMany({
    where: {
      user: {
        ranchId: result.user.ranchId,
        ...(userId && userId !== "all" ? { id: userId } : {}),
        ...(role && role !== "all" ? { role: role as Role } : {}),
      },
      ...(entityType && entityType !== "all" ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(action && action !== "all" ? { action } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json(logs);
}
