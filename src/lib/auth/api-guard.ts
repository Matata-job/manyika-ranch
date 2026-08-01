import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  hasPermission,
  canAccessCamp,
  canAccessAllCamps,
  isCampScopedRole,
  type Permission,
} from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { Role, type Prisma } from "@prisma/client";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  ranchId: string;
};

type AuthOk = { ok: true; user: AuthUser };
type AuthFail = { ok: false; error: NextResponse };
type AuthResult = AuthOk | AuthFail;

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return {
    ok: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as Role,
      ranchId: session.user.ranchId,
    },
  };
}

export async function requirePermission(permission: Permission): Promise<AuthResult> {
  const result = await requireAuth();
  if (!result.ok) return result;

  if (!hasPermission(result.user.role, permission)) {
    return { ok: false, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}

export async function getUserCampIds(userId: string): Promise<string[]> {
  const assignments = await prisma.userCampAssignment.findMany({
    where: { userId },
    select: { campId: true },
  });
  return assignments.map((a) => a.campId);
}

export async function resolveAccessibleCampIds(
  userId: string,
  role: Role
): Promise<"all" | string[]> {
  if (role === Role.EXTERNAL_OWNER) return "all";
  if (canAccessAllCamps(role)) return "all";
  return getUserCampIds(userId);
}

type CampAccessOk = AuthOk & { campIds: string[] };
export async function requireCampAccess(campId: string): Promise<CampAccessOk | AuthFail> {
  const result = await requireAuth();
  if (!result.ok) return result;

  const campIds = await getUserCampIds(result.user.id);

  if (!canAccessCamp(result.user.role, campId, campIds)) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Forbidden: camp access denied" }, { status: 403 }),
    };
  }

  return { ...result, campIds };
}

export async function buildAnimalScope(
  userId: string,
  role: Role,
  options?: { campId?: string | null }
): Promise<Prisma.AnimalWhereInput | { error: NextResponse }> {
  if (role === Role.EXTERNAL_OWNER) {
    return {
      ownerId: userId,
      ...(options?.campId ? { campId: options.campId } : {}),
    };
  }

  const accessible = await resolveAccessibleCampIds(userId, role);

  if (accessible === "all") {
    return options?.campId ? { campId: options.campId } : {};
  }

  if (accessible.length === 0) {
    return { id: "__none__" };
  }

  if (options?.campId) {
    if (!accessible.includes(options.campId)) {
      return {
        error: NextResponse.json(
          { error: "Forbidden: camp access denied" },
          { status: 403 }
        ),
      };
    }
    return { campId: options.campId };
  }

  return { campId: { in: accessible } };
}

export async function buildCampScope(
  userId: string,
  role: Role,
  ranchId: string
): Promise<Prisma.CampWhereInput> {
  if (role === Role.EXTERNAL_OWNER) {
    return {
      ranchId,
      animals: { some: { ownerId: userId } },
    };
  }

  const accessible = await resolveAccessibleCampIds(userId, role);
  if (accessible === "all") {
    return { ranchId };
  }

  return {
    ranchId,
    id: { in: accessible.length > 0 ? accessible : ["__none__"] },
  };
}

/** Movements involving animals currently in scope OR camps the user is assigned to. */
export async function buildMovementScope(
  userId: string,
  role: Role
): Promise<Prisma.MovementWhereInput | { error: NextResponse }> {
  if (role === Role.EXTERNAL_OWNER) {
    return { animal: { ownerId: userId } };
  }

  const accessible = await resolveAccessibleCampIds(userId, role);
  if (accessible === "all") return {};

  if (accessible.length === 0) {
    return { id: "__none__" };
  }

  return {
    OR: [
      { fromCampId: { in: accessible } },
      { toCampId: { in: accessible } },
      { animal: { campId: { in: accessible } } },
    ],
  };
}

/** Alerts visible to the user — camp-scoped roles never see ranch-wide orphan alerts,
 * except medicine stock alerts (no animal). */
export async function buildAlertScope(
  userId: string,
  role: Role
): Promise<Prisma.AlertWhereInput | { error: NextResponse }> {
  const animalScope = await buildAnimalScope(userId, role);
  if ("error" in animalScope) return animalScope;

  if (isCampScopedRole(role)) {
    return {
      OR: [
        { animal: animalScope },
        { animalId: null, type: "MEDICINE_LOW" },
      ],
    };
  }

  return {
    OR: [{ animalId: null }, { animal: animalScope }],
  };
}

type AnimalAccessOk = AuthOk & {
  animal: { id: string; campId: string; ownerId: string };
  campIds: string[];
};

export async function requireAnimalAccess(
  animalId: string
): Promise<AnimalAccessOk | AuthFail> {
  const result = await requireAuth();
  if (!result.ok) return result;

  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: { id: true, campId: true, ownerId: true },
  });

  if (!animal) {
    return { ok: false, error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  if (result.user.role === Role.EXTERNAL_OWNER) {
    if (animal.ownerId !== result.user.id) {
      return { ok: false, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { ...result, animal, campIds: [] };
  }

  const campIds = await getUserCampIds(result.user.id);
  if (!canAccessCamp(result.user.role, animal.campId, campIds)) {
    return { ok: false, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ...result, animal, campIds };
}

/** @deprecated Use buildAnimalScope */
export async function buildCampFilter(userId: string, role: Role) {
  const scope = await buildAnimalScope(userId, role);
  if ("error" in scope) return { id: "__none__" };
  return scope;
}
