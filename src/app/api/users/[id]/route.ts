import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth/api-guard";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  phone: true,
  nationalId: true,
  photoUrl: true,
  address: true,
  nextOfKin: true,
  isActive: true,
  createdAt: true,
  campAssignments: {
    include: { camp: { select: { id: true, name: true } } },
  },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const isSelf = result.user.id === id;
  if (!isSelf) {
    const perm = await requirePermission("manageUsers");
    if (!perm.ok) return perm.error;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const isSelf = result.user.id === id;
  const isManager =
    result.user.role === Role.OWNER || result.user.role === Role.FARM_MANAGER;

  if (!isSelf && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.nationalId !== undefined) updateData.nationalId = body.nationalId;
  if (body.photoUrl !== undefined) updateData.photoUrl = body.photoUrl;
  if (body.address !== undefined) updateData.address = body.address;
  if (body.nextOfKin !== undefined) updateData.nextOfKin = body.nextOfKin;

  if (isManager && !isSelf) {
    if (body.email !== undefined) updateData.email = body.email;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.role !== undefined) {
      if (
        result.user.role === Role.FARM_MANAGER &&
        body.role !== Role.CAMP_SUPERVISOR
      ) {
        return NextResponse.json(
          { error: "Managers can only set the Camp Supervisor role" },
          { status: 403 }
        );
      }
      updateData.role = body.role;
    }
    if (body.password) {
      updateData.passwordHash = await bcrypt.hash(body.password, 10);
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: USER_SELECT,
  });

  return NextResponse.json(user);
}
