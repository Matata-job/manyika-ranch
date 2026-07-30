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

  async function buildAncestors(
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
      animal.sireId ? buildAncestors(animal.sireId, depth + 1) : null,
      animal.damId ? buildAncestors(animal.damId, depth + 1) : null,
    ]);

    return { ...animal, sire, dam };
  }

  /** Calves / offspring tree (children where this animal is dam or sire). */
  async function buildOffspring(
    animalId: string,
    depth = 0
  ): Promise<Record<string, unknown>[]> {
    if (depth > 4) return [];
    const children = await prisma.animal.findMany({
      where: {
        OR: [{ damId: animalId }, { sireId: animalId }],
        status: { not: "MISSING" },
      },
      select: {
        id: true,
        eartag: true,
        breed: true,
        sex: true,
        dob: true,
        status: true,
        damId: true,
        sireId: true,
      },
      orderBy: [{ dob: "asc" }, { eartag: "asc" }],
    });

    return Promise.all(
      children.map(async (child) => ({
        ...child,
        via: child.damId === animalId ? "dam" : "sire",
        offspring: await buildOffspring(child.id, depth + 1),
      }))
    );
  }

  const [tree, offspring] = await Promise.all([
    buildAncestors(id),
    buildOffspring(id),
  ]);

  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...tree,
    offspring,
    offspringCount: countOffspring(offspring),
  });
}

function countOffspring(nodes: Record<string, unknown>[]): number {
  let n = nodes.length;
  for (const node of nodes) {
    const kids = node.offspring as Record<string, unknown>[] | undefined;
    if (kids?.length) n += countOffspring(kids);
  }
  return n;
}
