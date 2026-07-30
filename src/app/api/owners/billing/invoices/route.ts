import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import type { InvoiceStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewFinance");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("owner");
  const status = searchParams.get("status");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const invoices = await prisma.ownerInvoice.findMany({
    where: {
      ranchId: result.user.ranchId,
      ...(ownerId ? { ownerId } : {}),
      ...(status && status !== "all"
        ? { status: status as InvoiceStatus }
        : {}),
      ...(year ? { periodYear: parseInt(year, 10) } : {}),
      ...(month ? { periodMonth: parseInt(month, 10) } : {}),
    },
    include: {
      owner: { select: { id: true, name: true, phone: true, role: true } },
      payments: {
        orderBy: { paidAt: "desc" },
        include: { recordedBy: { select: { name: true } } },
      },
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json(invoices);
}
