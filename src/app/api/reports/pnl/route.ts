import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  buildAnimalScope,
  resolveAccessibleCampIds,
} from "@/lib/auth/api-guard";
import { prismaDateRange } from "@/lib/reports/date-range";
import type { Role } from "@prisma/client";

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewFinance");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const campId = searchParams.get("camp");

  const dateFilter = prismaDateRange(from, to);

  const animalScope = await buildAnimalScope(
    result.user.id,
    result.user.role as Role,
    { campId: campId && campId !== "all" ? campId : null }
  );
  if ("error" in animalScope) return animalScope.error;

  const accessible = await resolveAccessibleCampIds(
    result.user.id,
    result.user.role as Role
  );

  let campScope:
    | { campId: string }
    | { OR: ({ campId: null } | { campId: { in: string[] } })[] }
    | Record<string, never> = {};
  if (campId && campId !== "all") {
    if (accessible !== "all" && !accessible.includes(campId)) {
      return NextResponse.json({ error: "Forbidden: camp access denied" }, { status: 403 });
    }
    campScope = { campId };
  } else if (accessible !== "all") {
    campScope = {
      OR: [
        { campId: null },
        { campId: { in: accessible.length ? accessible : ["__none__"] } },
      ],
    };
  }

  const [sales, expenses, incomes] = await Promise.all([
    prisma.sale.findMany({
      where: {
        ...(dateFilter ? { saleDate: dateFilter } : {}),
        animal: animalScope,
      },
      include: {
        animal: {
          select: {
            camp: { select: { id: true, name: true } },
          },
        },
        buyerContact: { select: { id: true, name: true } },
      },
    }),
    prisma.expense.findMany({
      where: {
        ranchId: result.user.ranchId,
        ...campScope,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: { camp: { select: { id: true, name: true } } },
    }),
    prisma.otherIncome.findMany({
      where: {
        ranchId: result.user.ranchId,
        ...campScope,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: { camp: { select: { id: true, name: true } } },
    }),
  ]);

  const salesRevenue = sales.reduce((s, x) => s + x.priceTzs, 0);
  const otherIncome = incomes.reduce((s, x) => s + x.amountTzs, 0);
  const totalExpenses = expenses.reduce((s, x) => s + x.amountTzs, 0);
  const operatingExpenses = expenses
    .filter((e) => e.fundingSource !== "PROJECT")
    .reduce((s, x) => s + x.amountTzs, 0);
  const projectExpenses = totalExpenses - operatingExpenses;
  const net = salesRevenue + otherIncome - operatingExpenses;

  const expensesByCategory: Record<string, number> = {};
  for (const e of expenses) {
    if (e.fundingSource === "PROJECT") continue;
    const key =
      e.category === "OTHER" && e.categoryDetail?.trim()
        ? e.categoryDetail.trim()
        : e.category;
    expensesByCategory[key] = (expensesByCategory[key] || 0) + e.amountTzs;
  }

  const incomeByCategory: Record<string, number> = {};
  for (const i of incomes) {
    incomeByCategory[i.category] = (incomeByCategory[i.category] || 0) + i.amountTzs;
  }

  const monthly: Record<
    string,
    { sales: number; otherIncome: number; expenses: number; net: number }
  > = {};

  for (const s of sales) {
    const k = monthKey(s.saleDate);
    monthly[k] = monthly[k] || { sales: 0, otherIncome: 0, expenses: 0, net: 0 };
    monthly[k].sales += s.priceTzs;
  }
  for (const i of incomes) {
    const k = monthKey(i.date);
    monthly[k] = monthly[k] || { sales: 0, otherIncome: 0, expenses: 0, net: 0 };
    monthly[k].otherIncome += i.amountTzs;
  }
  for (const e of expenses) {
    if (e.fundingSource === "PROJECT") continue;
    const k = monthKey(e.date);
    monthly[k] = monthly[k] || { sales: 0, otherIncome: 0, expenses: 0, net: 0 };
    monthly[k].expenses += e.amountTzs;
  }
  for (const k of Object.keys(monthly)) {
    monthly[k].net =
      monthly[k].sales + monthly[k].otherIncome - monthly[k].expenses;
  }

  const byCamp: Record<
    string,
    { sales: number; otherIncome: number; expenses: number; net: number }
  > = {};

  for (const s of sales) {
    const name = s.animal.camp.name;
    byCamp[name] = byCamp[name] || { sales: 0, otherIncome: 0, expenses: 0, net: 0 };
    byCamp[name].sales += s.priceTzs;
  }
  for (const i of incomes) {
    const name = i.camp?.name || "Unassigned";
    byCamp[name] = byCamp[name] || { sales: 0, otherIncome: 0, expenses: 0, net: 0 };
    byCamp[name].otherIncome += i.amountTzs;
  }
  for (const e of expenses) {
    if (e.fundingSource === "PROJECT") continue;
    const name = e.camp?.name || "Unassigned";
    byCamp[name] = byCamp[name] || { sales: 0, otherIncome: 0, expenses: 0, net: 0 };
    byCamp[name].expenses += e.amountTzs;
  }
  for (const k of Object.keys(byCamp)) {
    byCamp[k].net = byCamp[k].sales + byCamp[k].otherIncome - byCamp[k].expenses;
  }

  return NextResponse.json({
    summary: {
      salesRevenue,
      otherIncome,
      totalIncome: salesRevenue + otherIncome,
      totalExpenses: operatingExpenses,
      operatingExpenses,
      projectExpenses,
      net,
      saleCount: sales.length,
      expenseCount: expenses.length,
      otherIncomeCount: incomes.length,
    },
    expensesByCategory: Object.entries(expensesByCategory)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
    incomeByCategory: Object.entries(incomeByCategory)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
    monthly: Object.entries(monthly)
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    byCamp: Object.entries(byCamp)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.net - a.net),
  });
}
