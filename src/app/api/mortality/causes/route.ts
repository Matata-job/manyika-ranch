import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import {
  getCustomDeathCauses,
  normalizeCustomDeathCauseName,
  SYSTEM_DEATH_CAUSES,
} from "@/lib/death-causes";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const result = await requirePermission("viewAnimal");
  if (!result.ok) return result.error;

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });

  return NextResponse.json({
    system: [...SYSTEM_DEATH_CAUSES],
    custom: getCustomDeathCauses(ranch?.settings),
  });
}

/** Append a ranch-specific death cause (shown in pickers; stored as OTHER + detail). */
export async function POST(req: NextRequest) {
  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const body = await req.json().catch(() => ({}));
  const name = normalizeCustomDeathCauseName(String(body.name || ""));
  if (!name) {
    return NextResponse.json(
      { error: "Cause name is required (max 80 characters)" },
      { status: 400 }
    );
  }

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });
  const current = (ranch?.settings as Record<string, unknown>) || {};
  const existing = getCustomDeathCauses(current);
  const already = existing.find((c) => c.toLowerCase() === name.toLowerCase());
  const nextList = already
    ? existing
    : [...existing, name].sort((a, b) => a.localeCompare(b));

  if (!already) {
    await prisma.ranch.update({
      where: { id: result.user.ranchId },
      data: {
        settings: {
          ...current,
          customDeathCauses: nextList,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return NextResponse.json({
    system: [...SYSTEM_DEATH_CAUSES],
    custom: nextList,
    added: name,
  });
}

export async function DELETE(req: NextRequest) {
  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const name = normalizeCustomDeathCauseName(
    String(req.nextUrl.searchParams.get("name") || "")
  );
  if (!name) {
    return NextResponse.json({ error: "Cause name is required" }, { status: 400 });
  }

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });
  const current = (ranch?.settings as Record<string, unknown>) || {};
  const existing = getCustomDeathCauses(current);
  const nextList = existing.filter(
    (c) => c.toLowerCase() !== name.toLowerCase()
  );

  if (nextList.length === existing.length) {
    return NextResponse.json({ error: "Cause not found" }, { status: 404 });
  }

  await prisma.ranch.update({
    where: { id: result.user.ranchId },
    data: {
      settings: {
        ...current,
        customDeathCauses: nextList,
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ custom: nextList, removed: name });
}
