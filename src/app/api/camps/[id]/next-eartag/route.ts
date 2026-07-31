import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { suggestNextEartag } from "@/lib/eartag";

/** Suggest the next eartag number for a camp (follows MR-nn-NNN or last format). */
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

  const animals = await prisma.animal.findMany({
    where: { campId: id },
    select: { eartag: true },
  });

  const existing = animals.map((a) => a.eartag);
  // Include locally remembered last tag if somehow ahead of DB (offline creates)
  // Server cannot read localStorage; client merges separately.

  const suggested = suggestNextEartag({
    campCode: camp.code,
    existingEartags: existing,
  });

  // Find highest matching tag for display
  let lastEartag: string | null = null;
  if (camp.code) {
    const re = new RegExp(
      `^${camp.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`,
      "i"
    );
    let max = -1;
    for (const tag of existing) {
      const m = tag.match(re);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (n > max) {
        max = n;
        lastEartag = tag;
      }
    }
  }

  return NextResponse.json({
    campId: camp.id,
    campCode: camp.code,
    lastEartag,
    suggested,
    count: existing.length,
  });
}
