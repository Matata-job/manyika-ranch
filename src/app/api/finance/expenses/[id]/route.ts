import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { parseExpenseCategorySelection } from "@/lib/expense-categories";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageFinance");
  if (!result.ok) return result.error;

  const existing = await prisma.expense.findFirst({
    where: { id, ranchId: result.user.ranchId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.category !== undefined) {
    const parsed = parseExpenseCategorySelection(String(body.category));
    data.category = parsed.category;
    data.categoryDetail =
      parsed.category === "OTHER"
        ? typeof body.categoryDetail === "string" && body.categoryDetail.trim()
          ? body.categoryDetail.trim()
          : parsed.categoryDetail
        : null;
  }
  if (body.categoryDetail !== undefined && body.category === undefined) {
    data.categoryDetail =
      typeof body.categoryDetail === "string" && body.categoryDetail.trim()
        ? body.categoryDetail.trim()
        : null;
  }
  if (body.amountTzs !== undefined) {
    const amount = parseFloat(body.amountTzs);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    }
    data.amountTzs = amount;
  }
  if (body.quantity !== undefined) {
    if (body.quantity === null || body.quantity === "") {
      data.quantity = null;
    } else {
      const q = parseFloat(String(body.quantity));
      if (!Number.isFinite(q) || q < 0) {
        return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
      }
      data.quantity = q;
    }
  }
  if (body.unit !== undefined) {
    data.unit =
      typeof body.unit === "string" && body.unit.trim()
        ? body.unit.trim()
        : null;
  }
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (body.campId !== undefined) data.campId = body.campId || null;

  const expense = await prisma.expense.update({
    where: { id },
    data,
    include: {
      camp: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
    },
  });

  await createAuditLog(result.user.id, "UPDATE", "Expense", id, data);
  return NextResponse.json(expense);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageFinance");
  if (!result.ok) return result.error;

  const existing = await prisma.expense.findFirst({
    where: { id, ranchId: result.user.ranchId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  await prisma.expense.delete({ where: { id } });
  await createAuditLog(result.user.id, "DELETE", "Expense", id, {
    category: existing.category,
    amountTzs: existing.amountTzs,
  });

  return NextResponse.json({ success: true });
}
