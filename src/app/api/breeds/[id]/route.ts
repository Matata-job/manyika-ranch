import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageCamps");
  if (!result.ok) return result.error;

  const existing = await prisma.breedCatalog.findFirst({
    where: { id, ranchId: result.user.ranchId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Breed not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: { description?: string | null; photoUrl?: string | null; name?: string } =
    {};

  if (body.description !== undefined) {
    data.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
  }

  if (body.photoUrl !== undefined) {
    data.photoUrl =
      body.photoUrl === null || body.photoUrl === ""
        ? null
        : String(body.photoUrl).trim() || null;
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Breed name is required" }, { status: 400 });
    }
    if (name !== existing.name) {
      const clash = await prisma.breedCatalog.findUnique({
        where: {
          ranchId_name: { ranchId: result.user.ranchId, name },
        },
      });
      if (clash) {
        return NextResponse.json({ error: "Breed already exists" }, { status: 409 });
      }
    }
    data.name = name;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(existing);
  }

  const breed = await prisma.breedCatalog.update({
    where: { id },
    data,
  });

  return NextResponse.json(breed);
}
