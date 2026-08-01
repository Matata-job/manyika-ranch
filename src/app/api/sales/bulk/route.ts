import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildAnimalScope } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { logAnimalEventsBulk } from "@/lib/services/event-service";
import type { Role } from "@prisma/client";

/**
 * Bulk sell animals.
 * Body: {
 *   animalIds: string[],
 *   buyerId?, buyer?, createBuyer?, buyerPhone?, buyerLocation?,
 *   priceMode: "per_animal" | "total_split",
 *   priceTzs: number,
 *   weightAtSale?, saleDate?, transport?, notes?
 * }
 */
export async function POST(req: NextRequest) {
  const result = await requirePermission("manageSales");
  if (!result.ok) return result.error;

  const body = await req.json();
  const animalIds: string[] = Array.isArray(body.animalIds)
    ? [
        ...new Set(
          (body.animalIds as unknown[]).filter(
            (id): id is string => typeof id === "string" && id.length > 0
          )
        ),
      ]
    : [];

  if (animalIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one animal" },
      { status: 400 }
    );
  }
  if (animalIds.length > 500) {
    return NextResponse.json(
      { error: "Maximum 500 animals per bulk sale" },
      { status: 400 }
    );
  }

  const priceMode =
    body.priceMode === "total_split" ? "total_split" : "per_animal";
  const priceInput = parseFloat(String(body.priceTzs));
  if (!Number.isFinite(priceInput) || priceInput < 0) {
    return NextResponse.json(
      { error: "Valid price (TZS) is required" },
      { status: 400 }
    );
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
      fromBulkSale: true,
    });
  }

  if (!buyerName) {
    return NextResponse.json(
      { error: "Buyer is required (select a contact or enter a name)" },
      { status: 400 }
    );
  }

  const weightRaw =
    body.weightAtSale != null && body.weightAtSale !== ""
      ? parseFloat(String(body.weightAtSale))
      : null;
  const weightAtSale =
    weightRaw != null && Number.isFinite(weightRaw) ? weightRaw : null;
  const saleDate = body.saleDate ? new Date(body.saleDate) : new Date();
  const transport =
    typeof body.transport === "string" && body.transport.trim()
      ? body.transport.trim()
      : null;
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : null;

  const scope = await buildAnimalScope(
    result.user.id,
    result.user.role as Role
  );
  if ("error" in scope) return scope.error;

  const animals = await prisma.animal.findMany({
    where: {
      id: { in: animalIds },
      status: { in: ["ACTIVE", "QUARANTINE", "MISSING"] },
      ...scope,
    },
    select: { id: true, eartag: true },
  });

  if (animals.length === 0) {
    return NextResponse.json(
      { error: "No accessible sellable animals found for the selection" },
      { status: 400 }
    );
  }

  const pricePerAnimal =
    priceMode === "total_split"
      ? Math.round((priceInput / animals.length) * 100) / 100
      : priceInput;

  const saleRows: { animalId: string; saleId: string; eartag: string }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const animal of animals) {
      const sale = await tx.sale.create({
        data: {
          animalId: animal.id,
          buyer: buyerName,
          buyerId,
          priceTzs: pricePerAnimal,
          weightAtSale,
          saleDate,
          transport,
          notes,
        },
      });
      saleRows.push({
        animalId: animal.id,
        saleId: sale.id,
        eartag: animal.eartag,
      });

      await tx.animal.update({
        where: { id: animal.id },
        data: { status: "SOLD" },
      });
    }
  });

  // Timeline events after sales commit so Events always stays in sync
  const pricePerKg =
    weightAtSale && weightAtSale > 0
      ? Math.round(pricePerAnimal / weightAtSale)
      : null;

  await logAnimalEventsBulk(
    saleRows.map((row) => ({
      animalId: row.animalId,
      type: "SALE" as const,
      title: `Sold to ${buyerName}`,
      description: [
        `TZS ${pricePerAnimal.toLocaleString()}`,
        weightAtSale ? `${weightAtSale} kg` : null,
        pricePerKg != null ? `TZS ${pricePerKg.toLocaleString()}/kg` : null,
        "bulk sale",
      ]
        .filter(Boolean)
        .join(" · "),
      occurredAt: saleDate,
      recordedById: result.user.id,
      metadata: {
        saleId: row.saleId,
        buyer: buyerName,
        buyerId,
        priceTzs: pricePerAnimal,
        weightAtSale,
        bulk: true,
      },
    }))
  );

  await createAuditLog(
    result.user.id,
    "CREATE",
    "BulkSale",
    result.user.ranchId,
    {
      buyer: buyerName,
      buyerId,
      priceMode,
      priceInput,
      pricePerAnimal,
      count: animals.length,
      animalIds: animals.map((a) => a.id),
      skipped: animalIds.length - animals.length,
      saleIds: saleRows.map((r) => r.saleId),
    }
  );

  return NextResponse.json(
    {
      success: true,
      sold: animals.length,
      skipped: animalIds.length - animals.length,
      pricePerAnimal,
      buyer: buyerName,
      eartags: animals.map((a) => a.eartag),
    },
    { status: 201 }
  );
}
