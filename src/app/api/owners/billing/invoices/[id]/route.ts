import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { invoiceBalance } from "@/lib/services/billing-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("viewFinance");
  if (!result.ok) return result.error;

  const invoice = await prisma.ownerInvoice.findFirst({
    where: { id, ranchId: result.user.ranchId },
    include: {
      owner: {
        select: { id: true, name: true, phone: true, email: true, role: true },
      },
      payments: {
        orderBy: { paidAt: "desc" },
        include: { recordedBy: { select: { name: true } } },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...invoice,
    balanceTzs: invoiceBalance(invoice.amountTzs, invoice.amountPaidTzs),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageFinance");
  if (!result.ok) return result.error;

  const invoice = await prisma.ownerInvoice.findFirst({
    where: { id, ranchId: result.user.ranchId },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.notes !== undefined) {
    data.notes = body.notes?.trim() || null;
  }
  if (body.status === "VOID") {
    if (invoice.amountPaidTzs > 0) {
      return NextResponse.json(
        { error: "Cannot void an invoice with payments — reverse payments first" },
        { status: 400 }
      );
    }
    data.status = "VOID";
  }

  const updated = await prisma.ownerInvoice.update({
    where: { id },
    data,
    include: {
      owner: { select: { id: true, name: true } },
    },
  });

  await createAuditLog(result.user.id, "UPDATE", "OwnerInvoice", id, body);

  return NextResponse.json(updated);
}
