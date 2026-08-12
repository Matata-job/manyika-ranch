import {
  buildCampScope,
  buildAnimalScope,
  userCanAccessCamp,
} from "@/lib/auth/api-guard";
import type { Role, Prisma } from "@prisma/client";

export { userCanAccessCamp };

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

