import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import bcrypt from "bcryptjs";

export async function GET() {
  const result = await requirePermission("manageUsers");
  if (!result.ok) return result.error;

  const users = await prisma.user.findMany({
    where: { ranchId: result.user.ranchId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      campAssignments: {
        include: { camp: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageUsers");
  if (!result.ok) return result.error;

  const body = await req.json();
  const passwordHash = await bcrypt.hash(body.password || "changeme123", 10);

  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash,
      role: body.role,
      ranchId: result.user.ranchId,
      campAssignments: body.campIds?.length
        ? {
            create: body.campIds.map((campId: string) => ({ campId })),
          }
        : undefined,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(user, { status: 201 });
}
