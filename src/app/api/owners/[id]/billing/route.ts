import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

/** Toggle grazing fee exempt for a cattle owner. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageFinance");
  if (!result.ok) return result.error;

  const owner = await prisma.user.findFirst({
    where: {
      id,
      ranchId: result.user.ranchId,
      role: { in: ["OWNER", "EXTERNAL_OWNER"] },
    },
  });
  if (!owner) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }

  const body = await req.json();
  if (typeof body.grazingFeeExempt !== "boolean") {
    return NextResponse.json(
      { error: "grazingFeeExempt boolean required" },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { grazingFeeExempt: body.grazingFeeExempt },
    select: {
      id: true,
      name: true,
      grazingFeeExempt: true,
      role: true,
    },
  });

  await createAuditLog(result.user.id, "UPDATE", "User", id, {
    grazingFeeExempt: body.grazingFeeExempt,
  });

  return NextResponse.json(updated);
}
