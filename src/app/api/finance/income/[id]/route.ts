import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageFinance");
  if (!result.ok) return result.error;

  const existing = await prisma.otherIncome.findFirst({
    where: { id, ranchId: result.user.ranchId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Income record not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.category !== undefined) data.category = body.category;
  if (body.amountTzs !== undefined) {
    const amount = parseFloat(body.amountTzs);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    }
    data.amountTzs = amount;
  }
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (body.campId !== undefined) data.campId = body.campId || null;

  const income = await prisma.otherIncome.update({
    where: { id },
    data,
    include: {
      camp: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
    },
  });

  await createAuditLog(result.user.id, "UPDATE", "OtherIncome", id, data);
  return NextResponse.json(income);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageFinance");
  if (!result.ok) return result.error;

  const existing = await prisma.otherIncome.findFirst({
    where: { id, ranchId: result.user.ranchId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Income record not found" }, { status: 404 });
  }

  await prisma.otherIncome.delete({ where: { id } });
  await createAuditLog(result.user.id, "DELETE", "OtherIncome", id, {
    category: existing.category,
    amountTzs: existing.amountTzs,
  });

  return NextResponse.json({ success: true });
}
