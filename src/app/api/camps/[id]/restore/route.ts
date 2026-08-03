import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

/** Restore a soft-deleted camp from Recently deleted. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageCamps");
  if (!result.ok) return result.error;

  const camp = await prisma.camp.findFirst({
    where: {
      id,
      ranchId: result.user.ranchId,
      deletedAt: { not: null },
    },
  });
  if (!camp) {
    return NextResponse.json({ error: "Deleted camp not found" }, { status: 404 });
  }

  const restored = await prisma.camp.update({
    where: { id },
    data: {
      deletedAt: null,
      deletedById: null,
      isActive: true,
    },
  });

  await createAuditLog(result.user.id, "UPDATE", "Camp", id, {
    restore: true,
    name: camp.name,
    code: camp.code,
  });
  return NextResponse.json(restored);
}
