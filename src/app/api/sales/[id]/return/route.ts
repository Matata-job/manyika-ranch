import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  requireAnimalAccess,
} from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { logAnimalEvent } from "@/lib/services/event-service";

/**
 * Return a sale and restore the animal to ACTIVE (refund).
 * Body: { reason: string, campId?: string, returnedAt?: string, refundedTzs?: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: saleId } = await params;
  const result = await requirePermission("manageSales");
  if (!result.ok) return result.error;

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      animal: {
        select: {
          id: true,
          eartag: true,
          status: true,
          campId: true,
          camp: { select: { ranchId: true } },
        },
      },
    },
  });

  if (!sale || sale.animal.camp.ranchId !== result.user.ranchId) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  const access = await requireAnimalAccess(sale.animalId);
  if (!access.ok) return access.error;

  if (sale.returnedAt) {
    return NextResponse.json(
      { error: "Sale was already returned" },
      { status: 409 }
    );
  }

  if (sale.animal.status !== "SOLD") {
    return NextResponse.json(
      {
        error:
          "Animal is not marked sold — only the current sold animal can be returned from this sale",
      },
      { status: 400 }
    );
  }

  const laterSale = await prisma.sale.findFirst({
    where: {
      animalId: sale.animalId,
      returnedAt: null,
      saleDate: { gt: sale.saleDate },
      id: { not: sale.id },
    },
    select: { id: true },
  });
  if (laterSale) {
    return NextResponse.json(
      { error: "A newer sale exists for this animal — return that one instead" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const reason =
    typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 500) {
    return NextResponse.json(
      { error: "Return reason is required (max 500 characters)" },
      { status: 400 }
    );
  }

  let campId =
    typeof body.campId === "string" && body.campId.trim()
      ? body.campId.trim()
      : sale.animal.campId;

  const camp = await prisma.camp.findFirst({
    where: {
      id: campId,
      ranchId: result.user.ranchId,
      deletedAt: null,
    },
    select: { id: true, name: true },
  });
  if (!camp) {
    return NextResponse.json(
      { error: "Choose a valid camp for the returned animal" },
      { status: 400 }
    );
  }
  campId = camp.id;

  const refundedRaw =
    body.refundedTzs !== undefined && body.refundedTzs !== null && body.refundedTzs !== ""
      ? parseFloat(String(body.refundedTzs))
      : sale.priceTzs;
  if (!Number.isFinite(refundedRaw) || refundedRaw < 0) {
    return NextResponse.json({ error: "Invalid refund amount" }, { status: 400 });
  }

  const returnedAt = body.returnedAt ? new Date(body.returnedAt) : new Date();
  if (Number.isNaN(returnedAt.getTime())) {
    return NextResponse.json({ error: "Invalid return date" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const returned = await tx.sale.update({
      where: { id: saleId },
      data: {
        returnedAt,
        returnedReason: reason,
        refundedTzs: refundedRaw,
        returnedToCampId: campId,
        returnedById: result.user.id,
      },
      include: {
        animal: {
          select: {
            id: true,
            eartag: true,
            breed: true,
            sex: true,
            camp: { select: { id: true, name: true } },
          },
        },
        returnedToCamp: { select: { id: true, name: true } },
      },
    });

    await tx.animal.update({
      where: { id: sale.animalId },
      data: {
        status: "ACTIVE",
        campId,
        herdPlan: "EXCLUDED",
        herdPlanNote: null,
        herdPlanAt: null,
      },
    });

    return returned;
  });

  await logAnimalEvent({
    animalId: sale.animalId,
    type: "STATUS_CHANGE",
    title: `Sale returned — refund to ${sale.buyer}`,
    description: [
      `Refund TZS ${refundedRaw.toLocaleString()}`,
      reason,
      `Back to ${camp.name}`,
    ]
      .filter(Boolean)
      .join(" · "),
    occurredAt: returnedAt,
    recordedById: result.user.id,
    metadata: {
      saleId: sale.id,
      buyer: sale.buyer,
      buyerId: sale.buyerId,
      priceTzs: sale.priceTzs,
      refundedTzs: refundedRaw,
      returnedReason: reason,
      returnedToCampId: campId,
      saleReturned: true,
    },
  });

  await createAuditLog(result.user.id, "UPDATE", "Sale", saleId, {
    returned: true,
    animalId: sale.animalId,
    eartag: sale.animal.eartag,
    buyer: sale.buyer,
    refundedTzs: refundedRaw,
    reason,
    campId,
  });

  return NextResponse.json(updated);
}
