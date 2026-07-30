import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { getRanchGrazingFeePerAnimal } from "@/lib/utils";
import { Role } from "@prisma/client";

/** Generate monthly grazing invoices for cattle owners. */
export async function POST(req: NextRequest) {
  const result = await requirePermission("manageFinance");
  if (!result.ok) return result.error;

  const body = await req.json();
  const now = new Date();
  const periodYear = body.year != null ? parseInt(String(body.year), 10) : now.getFullYear();
  const periodMonth =
    body.month != null ? parseInt(String(body.month), 10) : now.getMonth() + 1;

  if (
    !Number.isFinite(periodYear) ||
    !Number.isFinite(periodMonth) ||
    periodMonth < 1 ||
    periodMonth > 12
  ) {
    return NextResponse.json({ error: "Valid year and month required" }, { status: 400 });
  }

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });
  const rateTzs =
    body.rateTzs != null
      ? parseFloat(String(body.rateTzs))
      : getRanchGrazingFeePerAnimal(ranch?.settings);

  if (!Number.isFinite(rateTzs) || rateTzs <= 0) {
    return NextResponse.json(
      {
        error:
          "Set a grazing fee per animal in Ranch Settings before generating invoices",
      },
      { status: 400 }
    );
  }

  const ownerFilter =
    Array.isArray(body.ownerIds) && body.ownerIds.length > 0
      ? { id: { in: body.ownerIds as string[] } }
      : {};

  const owners = await prisma.user.findMany({
    where: {
      ranchId: result.user.ranchId,
      isActive: true,
      role: { in: [Role.OWNER, Role.EXTERNAL_OWNER] },
      grazingFeeExempt: false,
      ...ownerFilter,
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          ownedAnimals: {
            where: { status: { in: ["ACTIVE", "QUARANTINE"] } },
          },
        },
      },
    },
  });

  const created: { id: string; ownerId: string; amountTzs: number; animalCount: number }[] =
    [];
  const skipped: { ownerId: string; reason: string }[] = [];

  for (const owner of owners) {
    const animalCount = owner._count.ownedAnimals;
    if (animalCount === 0) {
      skipped.push({ ownerId: owner.id, reason: "no_animals" });
      continue;
    }

    const existing = await prisma.ownerInvoice.findUnique({
      where: {
        ranchId_ownerId_periodYear_periodMonth: {
          ranchId: result.user.ranchId,
          ownerId: owner.id,
          periodYear,
          periodMonth,
        },
      },
    });

    if (existing) {
      if (existing.status === "VOID") {
        // Re-issue voided invoice for the period
        const amountTzs = animalCount * rateTzs;
        const updated = await prisma.ownerInvoice.update({
          where: { id: existing.id },
          data: {
            animalCount,
            rateTzs,
            amountTzs,
            amountPaidTzs: 0,
            status: "ISSUED",
            notes: body.notes?.trim() || existing.notes,
          },
        });
        created.push({
          id: updated.id,
          ownerId: owner.id,
          amountTzs: updated.amountTzs,
          animalCount,
        });
      } else {
        skipped.push({ ownerId: owner.id, reason: "already_exists" });
      }
      continue;
    }

    const amountTzs = animalCount * rateTzs;
    const invoice = await prisma.ownerInvoice.create({
      data: {
        ranchId: result.user.ranchId,
        ownerId: owner.id,
        periodYear,
        periodMonth,
        animalCount,
        rateTzs,
        amountTzs,
        status: "ISSUED",
        notes: body.notes?.trim() || null,
      },
    });
    created.push({
      id: invoice.id,
      ownerId: owner.id,
      amountTzs: invoice.amountTzs,
      animalCount,
    });
  }

  await createAuditLog(result.user.id, "CREATE", "OwnerInvoiceBatch", result.user.ranchId, {
    periodYear,
    periodMonth,
    rateTzs,
    created: created.length,
    skipped: skipped.length,
  });

  return NextResponse.json(
    {
      periodYear,
      periodMonth,
      rateTzs,
      created,
      skipped,
    },
    { status: 201 }
  );
}
