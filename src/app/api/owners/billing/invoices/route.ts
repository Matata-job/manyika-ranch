import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import {
  isValidYearMonth,
  periodRangeWhere,
  type YearMonth,
} from "@/lib/services/billing-service";
import type { InvoiceStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewFinance");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("owner");
  const status = searchParams.get("status");
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const fromYear = searchParams.get("fromYear");
  const fromMonth = searchParams.get("fromMonth");
  const toYear = searchParams.get("toYear");
  const toMonth = searchParams.get("toMonth");

  let periodFilter: Record<string, unknown> = {};

  if (fromYear && fromMonth && toYear && toMonth) {
    const from: YearMonth = {
      year: parseInt(fromYear, 10),
      month: parseInt(fromMonth, 10),
    };
    const to: YearMonth = {
      year: parseInt(toYear, 10),
      month: parseInt(toMonth, 10),
    };
    if (!isValidYearMonth(from) || !isValidYearMonth(to)) {
      return NextResponse.json({ error: "Invalid period range" }, { status: 400 });
    }
    periodFilter = periodRangeWhere(from, to);
  } else if (year || month) {
    if (year) periodFilter.periodYear = parseInt(year, 10);
    if (month) periodFilter.periodMonth = parseInt(month, 10);
  }

  const invoices = await prisma.ownerInvoice.findMany({
    where: {
      ranchId: result.user.ranchId,
      ...(ownerId ? { ownerId } : {}),
      ...(status && status !== "all"
        ? { status: status as InvoiceStatus }
        : {}),
      ...periodFilter,
    },
    include: {
      owner: { select: { id: true, name: true, phone: true, role: true } },
      payments: {
        orderBy: { paidAt: "desc" },
        include: { recordedBy: { select: { name: true } } },
      },
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });

  return NextResponse.json(invoices);
}
