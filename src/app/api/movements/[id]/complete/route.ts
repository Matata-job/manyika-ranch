import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/api-guard";
import { completePendingMovement } from "@/lib/services/alert-sync";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requirePermission("manageMovements");
  if (!result.ok) return result.error;

  const { id } = await params;
  const outcome = await completePendingMovement(id, result.user.id);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }
  return NextResponse.json(outcome.movement);
}
