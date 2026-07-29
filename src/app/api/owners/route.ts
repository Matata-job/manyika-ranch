import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { Role } from "@prisma/client";

export async function GET() {
  const result = await requirePermission("createAnimal");
  if (!result.ok) return result.error;

  const owners = await prisma.user.findMany({
    where: {
      ranchId: result.user.ranchId,
      isActive: true,
      role: { in: [Role.OWNER, Role.EXTERNAL_OWNER] },
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(owners);
}
