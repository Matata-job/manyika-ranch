import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";
import { recordCalving } from "@/lib/services/breeding-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageBreeding");
  if (!result.ok) return result.error;

  const body = await req.json();

  if (body.damId) {
    const damAccess = await requireAnimalAccess(body.damId);
    if (!damAccess.ok) return damAccess.error;
  } else {
    // Resolve dam from breeding event
    const event = await prisma.breedingEvent.findUnique({
      where: { id },
      select: { damId: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Breeding event not found" }, { status: 404 });
    }
    const damAccess = await requireAnimalAccess(event.damId);
    if (!damAccess.ok) return damAccess.error;
    body.damId = event.damId;
  }

  try {
    const calving = await recordCalving(id, body, result.user.id);
    return NextResponse.json(calving, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to record calving" },
      { status: 400 }
    );
  }
}
