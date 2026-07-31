import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { getRanchGrazingFeePerAnimal } from "@/lib/utils";
import {
  expandPeriodRange,
  isValidYearMonth,
  resolvePresetRange,
  type BillingPeriodPreset,
  type YearMonth,
} from "@/lib/services/billing-service";
import { Role } from "@prisma/client";

const MAX_MONTHS = 24;

function parseYearMonth(year: unknown, month: unknown): YearMonth | null {
  if (year == null || month == null) return null;
  const p = {
    year: parseInt(String(year), 10),
    month: parseInt(String(month), 10),
  };
  return isValidYearMonth(p) ? p : null;
}

/** Generate grazing invoices for one or more calendar months. */
export async function POST(req: NextRequest) {
  const result = await requirePermission("manageFinance");
  if (!result.ok) return result.error;

  const body = await req.json();
  const now = new Date();

  let periods: YearMonth[] = [];

  if (body.preset || body.fromYear != null || body.toYear != null) {
    const preset = (body.preset || "custom") as BillingPeriodPreset;
    const customFrom = parseYearMonth(body.fromYear, body.fromMonth);
    const customTo = parseYearMonth(body.toYear, body.toMonth);
    const range = resolvePresetRange(
      preset,
      now,
      customFrom && customTo ? { from: customFrom, to: customTo } : undefined
    );
    if (!range) {
      return NextResponse.json(
        { error: "Valid period range required" },
        { status: 400 }
      );
    }
    periods = expandPeriodRange(range.from, range.to);
  } else {
    const single = parseYearMonth(
      body.year ?? now.getFullYear(),
      body.month ?? now.getMonth() + 1
    );
    if (!single) {
      return NextResponse.json(
        { error: "Valid year and month required" },
        { status: 400 }
      );
    }
    periods = [single];
  }

  if (periods.length === 0) {
    return NextResponse.json({ error: "No months in range" }, { status: 400 });
  }
  if (periods.length > MAX_MONTHS) {
    return NextResponse.json(
      { error: `Period cannot exceed ${MAX_MONTHS} months` },
      { status: 400 }
    );
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

  const created: {
    id: string;
    ownerId: string;
    amountTzs: number;
    animalCount: number;
    periodYear: number;
    periodMonth: number;
  }[] = [];
  const skipped: {
    ownerId: string;
    reason: string;
    periodYear: number;
    periodMonth: number;
  }[] = [];

  for (const { year: periodYear, month: periodMonth } of periods) {
    for (const owner of owners) {
      const animalCount = owner._count.ownedAnimals;
      if (animalCount === 0) {
        skipped.push({
          ownerId: owner.id,
          reason: "no_animals",
          periodYear,
          periodMonth,
        });
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
            periodYear,
            periodMonth,
          });
        } else {
          skipped.push({
            ownerId: owner.id,
            reason: "already_exists",
            periodYear,
            periodMonth,
          });
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
        periodYear,
        periodMonth,
      });
    }
  }

  const from = periods[0];
  const to = periods[periods.length - 1];

  await createAuditLog(result.user.id, "CREATE", "OwnerInvoiceBatch", result.user.ranchId, {
    from,
    to,
    months: periods.length,
    rateTzs,
    created: created.length,
    skipped: skipped.length,
  });

  return NextResponse.json(
    {
      from,
      to,
      months: periods.length,
      rateTzs,
      created,
      skipped,
    },
    { status: 201 }
  );
}
