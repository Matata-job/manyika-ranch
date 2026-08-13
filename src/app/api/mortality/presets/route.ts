import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { isKnownDisposalFormValue, normalizeDisposalMethod } from "@/lib/death-causes";
import {
  getRanchMortalityPresets,
  type MortalityPreset,
} from "@/lib/mortality-presets";
import type { Prisma } from "@prisma/client";

function normalizeLabel(label: string): string | null {
  const trimmed = label.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 80) return null;
  return trimmed;
}

function isValidDisposal(value: string): boolean {
  return isKnownDisposalFormValue(value);
}

async function readPresets(ranchId: string): Promise<MortalityPreset[]> {
  const ranch = await prisma.ranch.findUnique({
    where: { id: ranchId },
    select: { settings: true },
  });
  return getRanchMortalityPresets(ranch?.settings);
}

async function writePresets(ranchId: string, presets: MortalityPreset[]) {
  const ranch = await prisma.ranch.findUnique({
    where: { id: ranchId },
    select: { settings: true },
  });
  const current = (ranch?.settings as Record<string, unknown>) || {};
  await prisma.ranch.update({
    where: { id: ranchId },
    data: {
      settings: {
        ...current,
        mortalityPresets: presets,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function GET() {
  const result = await requirePermission("viewAnimal");
  if (!result.ok) return result.error;

  const presets = await readPresets(result.user.ranchId);
  return NextResponse.json({ presets, custom: presets, system: [] });
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const body = await req.json().catch(() => ({}));
  const label = normalizeLabel(String(body.label || ""));
  const disposalMethod = normalizeDisposalMethod(String(body.disposalMethod || ""));
  if (!label) {
    return NextResponse.json({ error: "Preset label is required" }, { status: 400 });
  }
  if (!isValidDisposal(disposalMethod)) {
    return NextResponse.json({ error: "Invalid disposal method" }, { status: 400 });
  }

  const causeValue =
    typeof body.causeValue === "string" && body.causeValue.trim()
      ? body.causeValue.trim()
      : undefined;

  const preset: MortalityPreset = {
    id: `custom:${randomUUID()}`,
    label,
    causeValue,
    disposalMethod,
    isCulling: Boolean(body.isCulling),
  };

  const existing = await readPresets(result.user.ranchId);
  const next = [...existing, preset];
  await writePresets(result.user.ranchId, next);

  return NextResponse.json({ preset, presets: next, custom: next });
}

export async function PATCH(req: NextRequest) {
  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) {
    return NextResponse.json({ error: "Preset id is required" }, { status: 400 });
  }

  const existing = await readPresets(result.user.ranchId);
  const index = existing.findIndex((p) => p.id === id);
  if (index < 0) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  const current = existing[index];
  const label =
    body.label !== undefined
      ? normalizeLabel(String(body.label))
      : current.label;
  if (!label) {
    return NextResponse.json({ error: "Preset label is required" }, { status: 400 });
  }

  let disposalMethod = current.disposalMethod;
  if (body.disposalMethod !== undefined) {
    const next = normalizeDisposalMethod(String(body.disposalMethod));
    if (!isValidDisposal(next)) {
      return NextResponse.json({ error: "Invalid disposal method" }, { status: 400 });
    }
    disposalMethod = next;
  }

  const causeValue =
    body.causeValue === null || body.causeValue === ""
      ? undefined
      : body.causeValue !== undefined
        ? String(body.causeValue).trim() || undefined
        : current.causeValue;

  const updated: MortalityPreset = {
    ...current,
    label,
    causeValue,
    disposalMethod,
    isCulling:
      body.isCulling !== undefined ? Boolean(body.isCulling) : current.isCulling,
  };

  const next = [...existing];
  next[index] = updated;
  await writePresets(result.user.ranchId, next);

  return NextResponse.json({ preset: updated, presets: next, custom: next });
}

export async function DELETE(req: NextRequest) {
  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const id = String(req.nextUrl.searchParams.get("id") || "");
  if (!id) {
    return NextResponse.json({ error: "Preset id is required" }, { status: 400 });
  }

  const existing = await readPresets(result.user.ranchId);
  const next = existing.filter((p) => p.id !== id);
  if (next.length === existing.length) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  await writePresets(result.user.ranchId, next);
  return NextResponse.json({ presets: next, custom: next, removed: id });
}
