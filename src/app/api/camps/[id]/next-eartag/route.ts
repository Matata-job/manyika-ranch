import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { suggestNextEartag } from "@/lib/eartag";

/**
 * Suggest the next free eartag for a camp.
 * Sequence follows this camp’s numbers; skips any tag already used ranch-wide.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("viewAnimal");
  if (!result.ok) return result.error;

  const camp = await prisma.camp.findFirst({
    where: { id, ranchId: result.user.ranchId },
    select: { id: true, code: true, name: true },
  });
  if (!camp) {
    return NextResponse.json({ error: "Camp not found" }, { status: 404 });
  }

  const ranchAnimals = await prisma.animal.findMany({
    where: { camp: { ranchId: result.user.ranchId } },
    select: { eartag: true, campId: true },
  });

  const allEartags = ranchAnimals.map((a) => a.eartag);
  const campEartags = ranchAnimals
    .filter((a) => a.campId === id)
    .map((a) => a.eartag);

  const suggested = suggestNextEartag({
    campCode: camp.code,
    sequenceEartags: campEartags,
    existingEartags: allEartags,
  });

  let lastEartag: string | null = null;
  if (camp.code) {
    const re = new RegExp(
      `^${camp.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`,
      "i"
    );
    let max = -1;
    for (const tag of campEartags) {
      const m = tag.match(re);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (n > max) {
        max = n;
        lastEartag = tag;
      }
    }
  } else if (campEartags.length > 0) {
    lastEartag = [...campEartags].sort().at(-1) || null;
  }

  return NextResponse.json({
    campId: camp.id,
    campCode: camp.code,
    lastEartag,
    suggested,
    count: campEartags.length,
  });
}
