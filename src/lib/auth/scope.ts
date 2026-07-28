import {
  getUserCampIds,
  buildCampScope,
  buildAnimalScope,
} from "@/lib/auth/api-guard";
import { canAccessAllCamps } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import type { Role, Prisma } from "@prisma/client";

export async function getScopedCampWhere(
  userId: string,
  role: Role,
  ranchId: string
): Promise<Prisma.CampWhereInput> {
  return buildCampScope(userId, role, ranchId);
}

export async function getScopedAnimalWhere(
  userId: string,
  role: Role,
  options?: { campId?: string | null }
): Promise<Prisma.AnimalWhereInput> {
  const scope = await buildAnimalScope(userId, role, options);
  if ("error" in scope) {
    return { id: "__none__" };
  }
  return scope;
}

export async function userCanAccessCamp(
  userId: string,
  role: Role,
  campId: string
): Promise<boolean> {
  if (canAccessAllCamps(role)) return true;

  if (role === "EXTERNAL_OWNER") {
    const owned = await prisma.animal.findFirst({
      where: { campId, ownerId: userId },
      select: { id: true },
    });
    return !!owned;
  }

  // CAMP_SUPERVISOR and any other camp-assigned role
  const campIds = await getUserCampIds(userId);
  return campIds.includes(campId);
}
