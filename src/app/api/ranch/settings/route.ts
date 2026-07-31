import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/api-guard";
import { hasPermission } from "@/lib/auth/rbac";
import {
  getRanchAgeDisplayMode,
  getRanchGrazingFeePerAnimal,
  type AgeDisplayMode,
} from "@/lib/utils";
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
    settings: updated.settings,
  });
}
