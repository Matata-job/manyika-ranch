import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";

export async function GET(req: NextRequest) {
  const result = await requirePermission("manageUsers");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(logs);
}
