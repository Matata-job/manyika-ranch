import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildAnimalScope } from "@/lib/auth/api-guard";
import { ageGroupWhere } from "@/lib/reports/age-filter";
import { prismaDateRange } from "@/lib/reports/date-range";
import type { Role, Sex } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewSales");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const campId = searchParams.get("camp");
  const breed = searchParams.get("breed");
  const sex = searchParams.get("sex");
  const ageGroup = searchParams.get("ageGroup");
  const buyerId = searchParams.get("buyerId");
  const ownerId = searchParams.get("owner");
  const status = searchParams.get("status"); // all | active | returned
  const q = searchParams.get("q")?.trim() || "";
  const buyerQ = searchParams.get("buyer")?.trim() || "";

  const scope = await buildAnimalScope(result.user.id, result.user.role as Role, {
    campId: campId && campId !== "all" ? campId : null,
  });
  if ("error" in scope) return scope.error;

  const ageWhere = ageGroupWhere(ageGroup);
  const dateFilter = prismaDateRange(from, to);

  const sales = await prisma.sale.findMany({
    where: {
      ...(dateFilter ? { saleDate: dateFilter } : {}),
      ...(status === "active" ? { returnedAt: null } : {}),
      ...(status === "returned" ? { returnedAt: { not: null } } : {}),
      ...(buyerId && buyerId !== "all" ? { buyerId } : {}),
      ...(buyerQ && !(buyerId && buyerId !== "all")
        ? { buyer: { contains: buyerQ, mode: "insensitive" } }
        : {}),
      animal: {
        ...scope,
        ...(breed && breed !== "all" ? { breed } : {}),
        ...(sex && sex !== "all" ? { sex: sex as Sex } : {}),
        ...(ownerId && ownerId !== "all" ? { ownerId } : {}),
        ...(ageWhere ? { AND: [ageWhere] } : {}),
        ...(q
          ? {
              OR: [
                { eartag: { contains: q, mode: "insensitive" } },
                { rfidChip: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    },
    include: {
      animal: {
        select: {
          id: true,
          eartag: true,
          breed: true,
          sex: true,
          ageMonths: true,
          camp: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
        },
      },
      buyerContact: { select: { id: true, name: true } },
      returnedToCamp: { select: { id: true, name: true } },
    },
    orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const activeSales = sales.filter((s) => !s.returnedAt);
  const returnedSales = sales.filter((s) => s.returnedAt);
  const returnedCount = returnedSales.length;
  const totalRefunded = returnedSales.reduce(
    (sum, s) => sum + (s.refundedTzs ?? s.priceTzs),
    0
  );

  const totalRevenue = activeSales.reduce((sum, s) => sum + s.priceTzs, 0);
  const totalWeight = activeSales.reduce(
    (sum, s) => sum + (s.weightAtSale || 0),
    0
  );
  const withWeight = activeSales.filter(
    (s) => s.weightAtSale && s.weightAtSale > 0
  );
  const avgPrice = activeSales.length ? totalRevenue / activeSales.length : 0;
  const avgPricePerKg =
    withWeight.length > 0
      ? withWeight.reduce(
          (sum, s) => sum + s.priceTzs / (s.weightAtSale as number),
          0
        ) / withWeight.length
      : null;

  const byBreed: Record<string, { count: number; revenue: number }> = {};
  const byCamp: Record<string, { count: number; revenue: number }> = {};
  const bySex: Record<string, { count: number; revenue: number }> = {};
  const byBuyer: Record<
    string,
    { count: number; revenue: number; buyerId: string | null }
  > = {};

  for (const s of activeSales) {
    const breedKey = s.animal.breed || "Unknown";
    byBreed[breedKey] = byBreed[breedKey] || { count: 0, revenue: 0 };
    byBreed[breedKey].count += 1;
    byBreed[breedKey].revenue += s.priceTzs;

    const campKey = s.animal.camp.name;
    byCamp[campKey] = byCamp[campKey] || { count: 0, revenue: 0 };
    byCamp[campKey].count += 1;
    byCamp[campKey].revenue += s.priceTzs;

    const sexKey = s.animal.sex;
    bySex[sexKey] = bySex[sexKey] || { count: 0, revenue: 0 };
    bySex[sexKey].count += 1;
    bySex[sexKey].revenue += s.priceTzs;

    const buyerKey = s.buyerId ? `id:${s.buyerId}` : `name:${s.buyer}`;
    byBuyer[buyerKey] = byBuyer[buyerKey] || {
      count: 0,
      revenue: 0,
      buyerId: s.buyerId,
    };
    byBuyer[buyerKey].count += 1;
    byBuyer[buyerKey].revenue += s.priceTzs;
  }

  return NextResponse.json({
    summary: {
      count: activeSales.length,
      returnedCount,
      totalCount: sales.length,
      totalRevenue,
      totalWeight,
      totalRefunded,
      avgPrice,
      avgPricePerKg,
    },
    byBreed: Object.entries(byBreed)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    byCamp: Object.entries(byCamp)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    bySex: Object.entries(bySex)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    byBuyer: Object.entries(byBuyer)
      .map(([key, v]) => ({
        name: key.startsWith("id:")
          ? sales.find((s) => s.buyerId === key.slice(3))?.buyer || key
          : key.slice(5),
        ...v,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20),
    sales,
  });
}
