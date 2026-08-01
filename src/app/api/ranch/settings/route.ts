import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/api-guard";
import { hasPermission } from "@/lib/auth/rbac";
import {
  getRanchAgeDisplayMode,
  getRanchGrazingFeePerAnimal,
  type AgeDisplayMode,
} from "@/lib/utils";
import {
  getRanchDefaultTagColor,
  getRanchEartagYearColors,
  normalizeTagColor,
} from "@/lib/tag-color";
import { getHealthNotifyDaysEarly, getWeightAlertDropPercent, getWeightAlertMinKg } from "@/lib/services/health-schedule";
import type { Prisma, Role } from "@prisma/client";

export async function GET() {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { id: true, name: true, settings: true },
  });

  if (!ranch) {
    return NextResponse.json({ error: "Ranch not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: ranch.id,
    name: ranch.name,
    ageDisplayMode: getRanchAgeDisplayMode(ranch.settings),
    grazingFeePerAnimalTzs: getRanchGrazingFeePerAnimal(ranch.settings),
    healthNotifyDaysEarly: getHealthNotifyDaysEarly(ranch.settings),
    weightAlertDropPercent: getWeightAlertDropPercent(ranch.settings),
    weightAlertMinKg: getWeightAlertMinKg(ranch.settings),
    eartagYearColors: getRanchEartagYearColors(ranch.settings),
    defaultTagColor: getRanchDefaultTagColor(ranch.settings),
    settings: ranch.settings,
  });
}

export async function PATCH(req: NextRequest) {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const role = result.user.role as Role;
  const canManageCamps = hasPermission(role, "manageCamps");
  const canManageFinance = hasPermission(role, "manageFinance");
  if (!canManageCamps && !canManageFinance) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });

  const current = (ranch?.settings as Record<string, unknown>) || {};
  const next = { ...current };

  if (body.ageDisplayMode !== undefined) {
    if (!canManageCamps) {
      return NextResponse.json(
        { error: "Only ranch managers can change age display settings" },
        { status: 403 }
      );
    }
    const mode = body.ageDisplayMode as AgeDisplayMode;
    if (!["YEARS_AND_MONTHS", "MONTHS_ONLY", "AUTO"].includes(mode)) {
      return NextResponse.json({ error: "Invalid age display mode" }, { status: 400 });
    }
    next.ageDisplayMode = mode;
  }

  if (body.grazingFeePerAnimalTzs !== undefined) {
    const fee = parseFloat(String(body.grazingFeePerAnimalTzs));
    if (!Number.isFinite(fee) || fee < 0) {
      return NextResponse.json(
        { error: "Grazing fee must be a non-negative number" },
        { status: 400 }
      );
    }
    next.grazingFeePerAnimalTzs = fee;
  }

  if (body.healthNotifyDaysEarly !== undefined) {
    if (!canManageCamps) {
      return NextResponse.json(
        { error: "Only ranch managers can change health alert settings" },
        { status: 403 }
      );
    }
    const days = parseInt(String(body.healthNotifyDaysEarly), 10);
    if (!Number.isFinite(days) || days < 0 || days > 90) {
      return NextResponse.json(
        { error: "Health notify days must be between 0 and 90" },
        { status: 400 }
      );
    }
    next.healthNotifyDaysEarly = days;
  }

  if (body.weightAlertDropPercent !== undefined) {
    if (!canManageCamps) {
      return NextResponse.json(
        { error: "Only ranch managers can change weight alert settings" },
        { status: 403 }
      );
    }
    const pct = parseInt(String(body.weightAlertDropPercent), 10);
    if (!Number.isFinite(pct) || pct < 1 || pct > 80) {
      return NextResponse.json(
        { error: "Weight drop percent must be between 1 and 80" },
        { status: 400 }
      );
    }
    next.weightAlertDropPercent = pct;
  }

  if (body.weightAlertMinKg !== undefined) {
    if (!canManageCamps) {
      return NextResponse.json(
        { error: "Only ranch managers can change weight alert settings" },
        { status: 403 }
      );
    }
    if (body.weightAlertMinKg === null || body.weightAlertMinKg === "") {
      next.weightAlertMinKg = null;
    } else {
      const kg = parseFloat(String(body.weightAlertMinKg));
      if (!Number.isFinite(kg) || kg <= 0) {
        return NextResponse.json(
          { error: "Minimum weight must be a positive number" },
          { status: 400 }
        );
      }
      next.weightAlertMinKg = kg;
    }
  }

  if (body.defaultTagColor !== undefined) {
    if (!canManageCamps) {
      return NextResponse.json(
        { error: "Only ranch managers can change default eartag colour" },
        { status: 403 }
      );
    }
    if (body.defaultTagColor === null || body.defaultTagColor === "") {
      next.defaultTagColor = null;
    } else {
      const n = normalizeTagColor(String(body.defaultTagColor));
      if (!n) {
        return NextResponse.json(
          { error: "Invalid default tag colour" },
          { status: 400 }
        );
      }
      next.defaultTagColor = n;
    }
  }

  if (body.eartagYearColors !== undefined) {
    if (!canManageCamps) {
      return NextResponse.json(
        { error: "Only ranch managers can change eartag year colours" },
        { status: 403 }
      );
    }
    if (
      body.eartagYearColors === null ||
      (typeof body.eartagYearColors === "object" &&
        !Array.isArray(body.eartagYearColors))
    ) {
      const cleaned: Record<string, string> = {};
      if (body.eartagYearColors) {
        for (const [year, color] of Object.entries(
          body.eartagYearColors as Record<string, unknown>
        )) {
          if (!/^\d{4}$/.test(year)) continue;
          const n = normalizeTagColor(
            typeof color === "string" ? color : null
          );
          if (n) cleaned[year] = n;
        }
      }
      next.eartagYearColors = cleaned;
    } else {
      return NextResponse.json(
        { error: "eartagYearColors must be an object of year → colour" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.ranch.update({
    where: { id: result.user.ranchId },
    data: { settings: next as Prisma.InputJsonValue },
    select: { id: true, name: true, settings: true },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    ageDisplayMode: getRanchAgeDisplayMode(updated.settings),
    grazingFeePerAnimalTzs: getRanchGrazingFeePerAnimal(updated.settings),
    healthNotifyDaysEarly: getHealthNotifyDaysEarly(updated.settings),
    weightAlertDropPercent: getWeightAlertDropPercent(updated.settings),
    weightAlertMinKg: getWeightAlertMinKg(updated.settings),
    eartagYearColors: getRanchEartagYearColors(updated.settings),
    defaultTagColor: getRanchDefaultTagColor(updated.settings),
    settings: updated.settings,
  });
}
