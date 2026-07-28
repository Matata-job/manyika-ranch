import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("viewAnimal");
  if (!result.ok) return result.error;

  async function buildTree(
    animalId: string,
    depth = 0
  ): Promise<Record<string, unknown> | null> {
    if (depth > 4) return null;
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: {
        id: true,
        eartag: true,
        breed: true,
        sex: true,
        dob: true,
        sireId: true,
        damId: true,
      },
    });
    if (!animal) return null;

    const [sire, dam] = await Promise.all([
      animal.sireId ? buildTree(animal.sireId, depth + 1) : null,
      animal.damId ? buildTree(animal.damId, depth + 1) : null,
    ]);

    return { ...animal, sire, dam };
  }

  const tree = await buildTree(id);
  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tree);
}
