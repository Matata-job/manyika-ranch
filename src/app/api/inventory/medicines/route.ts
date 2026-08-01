import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth/api-guard";
import { syncMedicineAlerts } from "@/lib/services/alert-sync";

export async function GET() {
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const items = await prisma.medicineInventory.findMany({
    where: { ranchId: result.user.ranchId },
    include: { camp: { select: { id: true, name: true } } },
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const quantity = parseFloat(String(body.quantity ?? 0));
  const minQuantity = parseFloat(String(body.minQuantity ?? 10));
  if (!Number.isFinite(quantity) || quantity < 0) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }
  if (!Number.isFinite(minQuantity) || minQuantity < 0) {
    return NextResponse.json({ error: "Invalid min quantity" }, { status: 400 });
  }

  let campId: string | null = body.campId || null;
  if (campId) {
    const camp = await prisma.camp.findFirst({
      where: { id: campId, ranchId: result.user.ranchId },
      select: { id: true },
    });
    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 400 });
    }
  }

  const item = await prisma.medicineInventory.create({
    data: {
      ranchId: result.user.ranchId,
      campId,
      name,
      quantity,
      minQuantity,
      unit: typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "doses",
      expiry: body.expiry ? new Date(body.expiry) : null,
    },
  });

  await syncMedicineAlerts(result.user.ranchId);
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.medicineInventory.findFirst({
    where: { id: body.id, ranchId: result.user.ranchId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: {
    name?: string;
    quantity?: number;
    minQuantity?: number;
    unit?: string;
    expiry?: Date | null;
    campId?: string | null;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = name;
  }
  if (body.quantity !== undefined) {
    const q = parseFloat(String(body.quantity));
    if (!Number.isFinite(q) || q < 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    data.quantity = q;
  }
  if (body.minQuantity !== undefined) {
    const q = parseFloat(String(body.minQuantity));
    if (!Number.isFinite(q) || q < 0) {
      return NextResponse.json({ error: "Invalid min quantity" }, { status: 400 });
    }
    data.minQuantity = q;
  }
  if (body.unit !== undefined) {
    data.unit = String(body.unit).trim() || "doses";
  }
  if (body.expiry !== undefined) {
    data.expiry = body.expiry ? new Date(body.expiry) : null;
  }
  if (body.campId !== undefined) {
    if (body.campId) {
      const camp = await prisma.camp.findFirst({
        where: { id: body.campId, ranchId: result.user.ranchId },
      });
      if (!camp) {
        return NextResponse.json({ error: "Camp not found" }, { status: 400 });
      }
      data.campId = camp.id;
    } else {
      data.campId = null;
    }
  }

  const item = await prisma.medicineInventory.update({
    where: { id: existing.id },
    data,
  });

  await syncMedicineAlerts(result.user.ranchId);
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.medicineInventory.findFirst({
    where: { id, ranchId: result.user.ranchId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.medicineInventory.delete({ where: { id } });
  await syncMedicineAlerts(result.user.ranchId);
  return NextResponse.json({ success: true });
}
