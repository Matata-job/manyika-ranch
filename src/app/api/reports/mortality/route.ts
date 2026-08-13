import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildAnimalScope } from "@/lib/auth/api-guard";
import { hasPermission } from "@/lib/auth/rbac";
import { prismaDateRange } from "@/lib/reports/date-range";
import type { DeathCause, DisposalMethod, Role, Sex } from "@prisma/client";

function countBy(rows: { key: string }[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.key, (map.get(r.key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;

  const role = auth.user.role as Role;
  if (
    !hasPermission(role, "viewReports") &&
    !hasPermission(role, "manageMortality")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const breed = searchParams.get("breed");
  const sex = searchParams.get("sex");
  const kind = searchParams.get("kind"); // death | slaughter | all
  const cause = searchParams.get("cause");
  const disposal = searchParams.get("disposal");
  const insurance = searchParams.get("insurance"); // yes | no | all
  const q = searchParams.get("q")?.trim() || "";

  const animalScope = await buildAnimalScope(auth.user.id, role, {
    campId: campId && campId !== "all" ? campId : null,
  });
  if ("error" in animalScope) return animalScope.error;

  const dateRange = prismaDateRange(from, to);

  let causeFilter:
    | { cause: DeathCause; causeDetail?: string | null }
    | undefined;
  if (cause && cause !== "all") {
    if (cause.startsWith("custom:")) {
      causeFilter = {
        cause: "OTHER",
        causeDetail: cause.slice("custom:".length).trim() || null,
      };
    } else {
      causeFilter = { cause: cause as DeathCause };
    }
  }

  let disposalFilter:
    | { disposalMethod: DisposalMethod | { in: DisposalMethod[] } }
    | { disposalMethod: "OTHER"; disposalNotes: string }
    | undefined;
  if (disposal && disposal !== "all") {
    if (disposal.startsWith("custom:")) {
      disposalFilter = {
        disposalMethod: "OTHER",
        disposalNotes: disposal.slice("custom:".length).trim(),
      };
    } else if (disposal === "USED_FOR_FOOD") {
      disposalFilter = {
        disposalMethod: {
          in: ["USED_FOR_FOOD", "HOME_USE", "CAMP_USE"] as DisposalMethod[],
        },
      };
    } else {
      disposalFilter = { disposalMethod: disposal as DisposalMethod };
    }
  }

  const records = await prisma.deathRecord.findMany({
    where: {
      ...(dateRange ? { date: dateRange } : {}),
      ...(kind === "death" ? { isCulling: false } : {}),
      ...(kind === "slaughter" ? { isCulling: true } : {}),
      ...(insurance === "yes" ? { insuranceClaim: true } : {}),
      ...(insurance === "no" ? { insuranceClaim: false } : {}),
      ...(causeFilter
        ? causeFilter.causeDetail !== undefined
          ? {
              cause: causeFilter.cause,
              causeDetail: causeFilter.causeDetail,
            }
          : { cause: causeFilter.cause }
        : {}),
      ...(disposalFilter || {}),
      animal: {
        ...animalScope,
        ...(breed && breed !== "all" ? { breed } : {}),
        ...(sex && sex !== "all" ? { sex: sex as Sex } : {}),
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
    orderBy: { date: "desc" },
    take: 500,
    include: {
      animal: {
        select: {
          id: true,
          eartag: true,
          breed: true,
          sex: true,
          camp: { select: { id: true, name: true } },
        },
      },
      recordedBy: { select: { name: true } },
    },
  });

  const cullings = records.filter((r) => r.isCulling).length;
  const deaths = records.length - cullings;
  const insuranceClaims = records.filter((r) => r.insuranceClaim).length;

  const byCauseMap = records.reduce(
    (acc, r) => {
      const key =
        r.cause === "OTHER" && r.causeDetail?.trim()
          ? r.causeDetail.trim()
          : r.cause;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const byCause = Object.entries(byCauseMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const byCamp = countBy(
    records.map((r) => ({ key: r.animal.camp.name || "—" }))
  );
  const byBreed = countBy(records.map((r) => ({ key: r.animal.breed || "—" })));
  const byDisposal = countBy(
    records.map((r) => ({
      key:
        r.disposalMethod === "OTHER" && r.disposalNotes?.trim()
          ? r.disposalNotes.trim()
          : r.disposalMethod === "HOME_USE" || r.disposalMethod === "CAMP_USE"
            ? "USED_FOR_FOOD"
            : r.disposalMethod,
    }))
  );
  const bySex = countBy(records.map((r) => ({ key: r.animal.sex })));

  return NextResponse.json({
    total: records.length,
    deaths,
    cullings,
    insuranceClaims,
    byCause: byCauseMap,
    byCauseList: byCause,
    byCamp,
    byBreed,
    byDisposal,
    bySex,
    records,
  });
}
