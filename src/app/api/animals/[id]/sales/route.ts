import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  requireAnimalAccess,
} from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { logAnimalEvent } from "@/lib/services/event-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const sales = await prisma.sale.findMany({
    where: { animalId: id },
    orderBy: { saleDate: "desc" },
    include: {
      buyerContact: { select: { id: true, name: true, phone: true } },
    },
  });

  return NextResponse.json(sales);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageSales");
  if (!result.ok) return result.error;

  const animal = await prisma.animal.findUnique({
    where: { id },
    select: {
      id: true,
      eartag: true,
      status: true,
      breed: true,
      sex: true,
      camp: { select: { name: true } },
    },
  });
  if (!animal) {
    return NextResponse.json({ error: "Animal not found" }, { status: 404 });
  }
  if (animal.status === "SOLD") {
    return NextResponse.json({ error: "Animal is already sold" }, { status: 409 });
  }
  if (animal.status === "DECEASED") {
    return NextResponse.json(
      { error: "Cannot sell a deceased animal" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const priceTzs = parseFloat(body.priceTzs);
  if (!Number.isFinite(priceTzs) || priceTzs < 0) {
    return NextResponse.json({ error: "Valid price (TZS) is required" }, { status: 400 });
  }

  let buyerId: string | null = body.buyerId || null;
  let buyerName = typeof body.buyer === "string" ? body.buyer.trim() : "";

  if (buyerId) {
    const contact = await prisma.buyer.findFirst({
      where: { id: buyerId, ranchId: result.user.ranchId, isActive: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
    }
    buyerName = contact.name;
  } else if (body.createBuyer && buyerName) {
    const created = await prisma.buyer.create({
      data: {
        ranchId: result.user.ranchId,
        name: buyerName,
        phone: body.buyerPhone?.trim() || null,
        location: body.buyerLocation?.trim() || null,
      },
    });
    buyerId = created.id;
    await createAuditLog(result.user.id, "CREATE", "Buyer", created.id, {
      name: created.name,
      fromSale: true,
    });
  }

  if (!buyerName) {
    return NextResponse.json(
      { error: "Buyer is required (select a contact or enter a name)" },
      { status: 400 }
    );
  }

  const weightAtSale = body.weightAtSale ? parseFloat(body.weightAtSale) : null;
  const saleDate = body.saleDate ? new Date(body.saleDate) : new Date();

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        animalId: id,
        buyer: buyerName,
        buyerId,
        priceTzs,
        weightAtSale:
          weightAtSale != null && Number.isFinite(weightAtSale)
            ? weightAtSale
            : null,
        saleDate,
        transport: body.transport?.trim() || null,
        notes: body.notes?.trim() || null,
      },
      include: {
        buyerContact: { select: { id: true, name: true } },
      },
    });

    await tx.animal.update({
      where: { id },
      data: { status: "SOLD", markedForSale: false, saleCycleNote: null, markedForSaleAt: null },
    });

    return created;
  });

  const pricePerKg =
    sale.weightAtSale && sale.weightAtSale > 0
      ? Math.round(sale.priceTzs / sale.weightAtSale)
      : null;

  await logAnimalEvent({
    animalId: id,
    type: "SALE",
    title: `Sold to ${sale.buyer}`,
    description: [
      `TZS ${sale.priceTzs.toLocaleString()}`,
      sale.weightAtSale ? `${sale.weightAtSale} kg` : null,
      pricePerKg != null ? `TZS ${pricePerKg.toLocaleString()}/kg` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    occurredAt: sale.saleDate,
    recordedById: result.user.id,
    metadata: {
      saleId: sale.id,
      buyer: sale.buyer,
      buyerId: sale.buyerId,
      priceTzs: sale.priceTzs,
      weightAtSale: sale.weightAtSale,
    },
  });

  await createAuditLog(result.user.id, "SALE", "Animal", id, {
    saleId: sale.id,
    buyer: sale.buyer,
    buyerId: sale.buyerId,
    priceTzs: sale.priceTzs,
  });

  return NextResponse.json(sale, { status: 201 });
}
