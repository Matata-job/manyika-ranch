import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { getRanchGrazingFeePerAnimal } from "@/lib/utils";
import { invoiceBalance } from "@/lib/services/billing-service";
import { Role } from "@prisma/client";

/** Cattle owners with headcount, fee estimate, and outstanding balance. */
export async function GET() {
  const result = await requirePermission("viewFinance");
  if (!result.ok) return result.error;

  const ranchId = result.user.ranchId;
  const ranch = await prisma.ranch.findUnique({
    where: { id: ranchId },
    select: { name: true, settings: true },
  });
  const rateTzs = getRanchGrazingFeePerAnimal(ranch?.settings);

  const owners = await prisma.user.findMany({
    where: {
      ranchId,
      isActive: true,
      role: { in: [Role.OWNER, Role.EXTERNAL_OWNER] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      grazingFeeExempt: true,
      _count: {
        select: {
          ownedAnimals: {
            where: { status: { in: ["ACTIVE", "QUARANTINE"] } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const openInvoices = await prisma.ownerInvoice.findMany({
    where: {
      ranchId,
      status: { in: ["ISSUED", "PARTIAL"] },
    },
    select: {
      ownerId: true,
      amountTzs: true,
      amountPaidTzs: true,
    },
  });

  const outstandingByOwner = new Map<string, number>();
  for (const inv of openInvoices) {
    const bal = invoiceBalance(inv.amountTzs, inv.amountPaidTzs);
    outstandingByOwner.set(
      inv.ownerId,
      (outstandingByOwner.get(inv.ownerId) || 0) + bal
    );
  }

  const rows = owners
    .map((o) => {
      const animalCount = o._count.ownedAnimals;
      const monthlyEstimate =
        o.grazingFeeExempt || rateTzs <= 0 ? 0 : animalCount * rateTzs;
      return {
        id: o.id,
        name: o.name,
        email: o.email,
        phone: o.phone,
        role: o.role,
        grazingFeeExempt: o.grazingFeeExempt,
        animalCount,
        monthlyEstimate,
        outstandingTzs: outstandingByOwner.get(o.id) || 0,
      };
    })
    .filter((o) => o.animalCount > 0 || o.outstandingTzs > 0 || o.role === Role.EXTERNAL_OWNER);

  const totals = {
    owners: rows.length,
    animals: rows.reduce((s, r) => s + r.animalCount, 0),
    monthlyEstimate: rows.reduce((s, r) => s + r.monthlyEstimate, 0),
    outstandingTzs: rows.reduce((s, r) => s + r.outstandingTzs, 0),
  };

  return NextResponse.json({
    ranchName: ranch?.name || "Ranch",
    rateTzs,
    owners: rows,
    totals,
  });
}
