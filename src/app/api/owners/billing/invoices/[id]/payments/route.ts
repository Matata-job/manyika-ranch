import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import {
  deriveInvoiceStatus,
  invoiceBalance,
  periodLabel,
} from "@/lib/services/billing-service";

/** Record a grazing fee payment and post it to Other Income (GRAZING_FEES). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageFinance");
  if (!result.ok) return result.error;

  const invoice = await prisma.ownerInvoice.findFirst({
    where: { id, ranchId: result.user.ranchId },
    include: { owner: { select: { name: true } } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.status === "VOID") {
    return NextResponse.json({ error: "Invoice is void" }, { status: 400 });
  }
  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
  }

  const body = await req.json();
  const amountTzs = parseFloat(String(body.amountTzs));
  if (!Number.isFinite(amountTzs) || amountTzs <= 0) {
    return NextResponse.json({ error: "Valid payment amount required" }, { status: 400 });
  }

  const balance = invoiceBalance(invoice.amountTzs, invoice.amountPaidTzs);
  if (amountTzs > balance + 0.01) {
    return NextResponse.json(
      { error: `Payment exceeds balance (${balance} TZS)` },
      { status: 400 }
    );
  }

  const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
  const period = periodLabel(invoice.periodYear, invoice.periodMonth);

  const payment = await prisma.$transaction(async (tx) => {
    const income = await tx.otherIncome.create({
      data: {
        ranchId: result.user.ranchId,
        category: "GRAZING_FEES",
        amountTzs,
        date: paidAt,
        description: `Grazing fee — ${invoice.owner.name} — ${period}`,
        recordedById: result.user.id,
        notes: body.notes?.trim() || null,
      },
    });

    const pay = await tx.ownerPayment.create({
      data: {
        invoiceId: invoice.id,
        amountTzs,
        paidAt,
        method: body.method?.trim() || null,
        notes: body.notes?.trim() || null,
        recordedById: result.user.id,
        otherIncomeId: income.id,
      },
    });

    const newPaid = invoice.amountPaidTzs + amountTzs;
    const status = deriveInvoiceStatus(invoice.amountTzs, newPaid, invoice.status);

    await tx.ownerInvoice.update({
      where: { id: invoice.id },
      data: {
        amountPaidTzs: newPaid,
        status,
      },
    });

    return pay;
  });

  await createAuditLog(result.user.id, "CREATE", "OwnerPayment", payment.id, {
    invoiceId: invoice.id,
    amountTzs,
  });

  const refreshed = await prisma.ownerInvoice.findUnique({
    where: { id: invoice.id },
    include: {
      owner: { select: { id: true, name: true } },
      payments: { orderBy: { paidAt: "desc" }, take: 10 },
    },
  });

  return NextResponse.json(
    {
      payment,
      invoice: refreshed
        ? {
            ...refreshed,
            balanceTzs: invoiceBalance(
              refreshed.amountTzs,
              refreshed.amountPaidTzs
            ),
          }
        : null,
    },
    { status: 201 }
  );
}
