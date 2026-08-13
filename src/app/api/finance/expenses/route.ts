import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  resolveAccessibleCampIds,
} from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import type { Prisma, Role } from "@prisma/client";
import {
  getCustomExpenseCategories,
  getCustomExpenseUnits,
  isSystemExpenseCategory,
  parseExpenseAllocGroup,
  parseExpenseCategorySelection,
  parseExpenseFundingSource,
} from "@/lib/expense-categories";

async function financeCampFilter(
  userId: string,
  role: Role,
  campId: string | null
): Promise<Prisma.ExpenseWhereInput | { error: NextResponse }> {
  const accessible = await resolveAccessibleCampIds(userId, role);
  if (campId && campId !== "all") {
    if (accessible !== "all" && !accessible.includes(campId)) {
      return {
        error: NextResponse.json({ error: "Forbidden: camp access denied" }, { status: 403 }),
      };
    }
    return { campId };
  }
  if (accessible === "all") return {};
  return {
    OR: [{ campId: null }, { campId: { in: accessible.length ? accessible : ["__none__"] } }],
  };
}

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewFinance");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const campId = searchParams.get("camp");
  const category = searchParams.get("category");
  const funding = searchParams.get("funding");

  const campFilter = await financeCampFilter(
    result.user.id,
    result.user.role as Role,
    campId
  );
  if ("error" in campFilter) return campFilter.error;

  let categoryWhere: Prisma.ExpenseWhereInput = {};
  if (category && category !== "all") {
    if (category.startsWith("custom:")) {
      const detail = category.slice("custom:".length).trim();
      categoryWhere = { category: "OTHER", categoryDetail: detail };
    } else if (isSystemExpenseCategory(category)) {
      categoryWhere =
        category === "OTHER"
          ? { category: "OTHER", OR: [{ categoryDetail: null }, { categoryDetail: "" }] }
          : { category };
    }
  }

  const expenses = await prisma.expense.findMany({
    where: {
      ranchId: result.user.ranchId,
      ...campFilter,
      ...categoryWhere,
      ...(funding === "OPERATING" || funding === "PROJECT"
        ? { fundingSource: funding }
        : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    include: {
      camp: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
    take: 500,
  });

  const total = expenses.reduce((sum, e) => sum + e.amountTzs, 0);

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });

  return NextResponse.json({
    expenses,
    total,
    customExpenseCategories: getCustomExpenseCategories(ranch?.settings),
    customExpenseUnits: getCustomExpenseUnits(ranch?.settings),
  });
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageFinance");
  if (!result.ok) return result.error;

  const body = await req.json();
  const amountTzs = parseFloat(body.amountTzs);
  if (!Number.isFinite(amountTzs) || amountTzs < 0) {
    return NextResponse.json({ error: "Valid amount (TZS) is required" }, { status: 400 });
  }
  if (!body.category) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }

  const { category, categoryDetail } = parseExpenseCategorySelection(
    String(body.category)
  );
  // Allow body.categoryDetail override when category is OTHER
  const detail =
    category === "OTHER"
      ? (typeof body.categoryDetail === "string" && body.categoryDetail.trim()
          ? body.categoryDetail.trim()
          : categoryDetail)
      : null;

  if (category === "OTHER" && !detail) {
    // Plain OTHER without custom name is allowed
  }

  let quantity: number | null = null;
  if (body.quantity !== undefined && body.quantity !== null && body.quantity !== "") {
    const q = parseFloat(String(body.quantity));
    if (!Number.isFinite(q) || q < 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    quantity = q;
  }
  const unit =
    typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : null;

  const fundingSource = parseExpenseFundingSource(body.fundingSource);
  const allocGroup = parseExpenseAllocGroup(
    body.allocGroup,
    category,
    fundingSource
  );

  if (body.campId) {
    const camp = await prisma.camp.findFirst({
      where: { id: body.campId, ranchId: result.user.ranchId },
    });
    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }
  }

  // Persist new custom category / unit on ranch settings
  if (detail || unit) {
    const ranch = await prisma.ranch.findUnique({
      where: { id: result.user.ranchId },
      select: { settings: true },
    });
    const current = (ranch?.settings as Record<string, unknown>) || {};
    const next = { ...current };
    let changed = false;
    if (detail) {
      const cats = getCustomExpenseCategories(current);
      if (!cats.some((c) => c.toLowerCase() === detail.toLowerCase())) {
        next.customExpenseCategories = [...cats, detail];
        changed = true;
      }
    }
    if (unit) {
      const units = [
        ...getCustomExpenseUnits(current),
      ];
      // Only persist if not a default and not already custom
      const defaults = ["kg", "bags", "L", "pieces", "days", "hours", "trips", "bales", "tons"];
      if (
        !defaults.some((d) => d.toLowerCase() === unit.toLowerCase()) &&
        !units.some((u) => u.toLowerCase() === unit.toLowerCase())
      ) {
        next.customExpenseUnits = [...units, unit];
        changed = true;
      }
    }
    if (changed) {
      await prisma.ranch.update({
        where: { id: result.user.ranchId },
        data: { settings: next as Prisma.InputJsonValue },
      });
    }
  }

  const expense = await prisma.expense.create({
    data: {
      ranchId: result.user.ranchId,
      category,
      categoryDetail: detail,
      amountTzs,
      quantity,
      unit,
      date: body.date ? new Date(body.date) : new Date(),
      description: body.description?.trim() || null,
      campId: body.campId || null,
      fundingSource,
      allocGroup,
      recordedById: result.user.id,
      notes: body.notes?.trim() || null,
    },
    include: {
      camp: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
    },
  });

  await createAuditLog(result.user.id, "CREATE", "Expense", expense.id, {
    category: expense.category,
    categoryDetail: expense.categoryDetail,
    amountTzs: expense.amountTzs,
    quantity: expense.quantity,
    unit: expense.unit,
    fundingSource: expense.fundingSource,
    allocGroup: expense.allocGroup,
  });

  return NextResponse.json(expense, { status: 201 });
}
