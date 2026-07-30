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
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  // Put ranch OWNER first for default selection
  owners.sort((a, b) => {
    if (a.role === Role.OWNER && b.role !== Role.OWNER) return -1;
    if (b.role === Role.OWNER && a.role !== Role.OWNER) return 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json(owners);
}
