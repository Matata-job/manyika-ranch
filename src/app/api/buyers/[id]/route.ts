import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("viewBuyers");
  if (!result.ok) return result.error;

  const buyer = await prisma.buyer.findFirst({
    where: { id, ranchId: result.user.ranchId },
    include: {
      sales: {
        orderBy: { saleDate: "desc" },
        take: 100,
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
        },
      },
    },
  });

  if (!buyer) {
    return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
  }

  const totalSpent = buyer.sales.reduce((sum, s) => sum + s.priceTzs, 0);

  return NextResponse.json({ ...buyer, totalSpent });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageBuyers");
  if (!result.ok) return result.error;

  const existing = await prisma.buyer.findFirst({
    where: { id, ranchId: result.user.ranchId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!String(body.name).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    data.name = String(body.name).trim();
  }
  if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
  if (body.location !== undefined) data.location = body.location?.trim() || null;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const buyer = await prisma.buyer.update({
    where: { id },
    data,
  });

  await createAuditLog(result.user.id, "UPDATE", "Buyer", id, data);

  return NextResponse.json(buyer);
}
