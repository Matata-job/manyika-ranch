import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth/api-guard";

export async function GET() {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const breeds = await prisma.breedCatalog.findMany({
    where: { ranchId: result.user.ranchId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(breeds);
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageCamps");
  if (!result.ok) return result.error;

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Breed name is required" }, { status: 400 });
  }

  const existing = await prisma.breedCatalog.findUnique({
    where: {
      ranchId_name: {
        ranchId: result.user.ranchId,
        name: body.name.trim(),
      },
    },
  });
  if (existing) {
    return NextResponse.json({ error: "Breed already exists" }, { status: 409 });
  }

  const breed = await prisma.breedCatalog.create({
    data: {
      ranchId: result.user.ranchId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      photoUrl:
        typeof body.photoUrl === "string" && body.photoUrl.trim()
          ? body.photoUrl.trim()
          : null,
    },
  });

  return NextResponse.json(breed, { status: 201 });
}
