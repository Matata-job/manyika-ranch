import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { Role } from "@prisma/client";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageUsers");
  if (!result.ok) return result.error;

  const body = await req.json();
  const campIds: string[] = body.campIds ?? [];

  const targetUser = await prisma.user.findUnique({
    where: { id, ranchId: result.user.ranchId },
    select: { role: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (
    result.user.role === Role.FARM_MANAGER &&
    targetUser.role !== Role.CAMP_SUPERVISOR
  ) {
    return NextResponse.json(
      { error: "Managers can only assign camps to supervisors" },
      { status: 403 }
    );
  }

  await prisma.userCampAssignment.deleteMany({ where: { userId: id } });

  if (campIds.length > 0) {
    await prisma.userCampAssignment.createMany({
      data: campIds.map((campId) => ({ userId: id, campId })),
    });
  }

  return NextResponse.json({ ok: true, campIds });
}
