import { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  FARM_MANAGER: "Farm Manager",
  CAMP_SUPERVISOR: "Camp Supervisor",
  VETERINARIAN: "Veterinarian",
  RECORDS_CLERK: "Records Clerk",
  EXTERNAL_OWNER: "External Owner",
  VIEWER: "Viewer",
};

export const PERMISSIONS = {
  manageUsers: [Role.OWNER],
  manageCamps: [Role.OWNER, Role.FARM_MANAGER],
  viewCamps: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.CAMP_SUPERVISOR,
    Role.VETERINARIAN,
    Role.RECORDS_CLERK,
    Role.EXTERNAL_OWNER,
    Role.VIEWER,
  ],
  createAnimal: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.CAMP_SUPERVISOR,
    Role.RECORDS_CLERK,
  ],
  editAnimal: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.CAMP_SUPERVISOR,
    Role.RECORDS_CLERK,
  ],
  deleteAnimal: [Role.OWNER, Role.FARM_MANAGER],
  viewAnimal: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.CAMP_SUPERVISOR,
    Role.VETERINARIAN,
    Role.RECORDS_CLERK,
    Role.EXTERNAL_OWNER,
    Role.VIEWER,
  ],
  manageHealth: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.CAMP_SUPERVISOR,
    Role.VETERINARIAN,
    Role.RECORDS_CLERK,
  ],
  manageMovements: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.CAMP_SUPERVISOR,
  ],
  manageBreeding: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.CAMP_SUPERVISOR,
    Role.RECORDS_CLERK,
  ],
  manageMortality: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.CAMP_SUPERVISOR,
    Role.VETERINARIAN,
    Role.RECORDS_CLERK,
  ],
  manageEvents: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.CAMP_SUPERVISOR,
    Role.VETERINARIAN,
    Role.RECORDS_CLERK,
  ],
  viewReports: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.CAMP_SUPERVISOR,
    Role.VETERINARIAN,
    Role.RECORDS_CLERK,
    Role.VIEWER,
  ],
  importData: [Role.OWNER, Role.FARM_MANAGER, Role.RECORDS_CLERK],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function canAccessAllCamps(role: Role): boolean {
  const allCampRoles: Role[] = [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.VETERINARIAN,
    Role.RECORDS_CLERK,
    Role.VIEWER,
  ];
  return allCampRoles.includes(role);
}

/** Roles limited to assigned camps (or owned animals). */
export function isCampScopedRole(role: Role): boolean {
  return role === Role.CAMP_SUPERVISOR || role === Role.EXTERNAL_OWNER;
}

export function isReadOnlyRole(role: Role): boolean {
  return role === Role.VIEWER || role === Role.EXTERNAL_OWNER;
}

export function getAccessibleCampIds(
  role: Role,
  assignedCampIds: string[]
): string[] | "all" {
  if (canAccessAllCamps(role)) return "all";
  return assignedCampIds;
}

export function canAccessCamp(
  role: Role,
  campId: string,
  assignedCampIds: string[]
): boolean {
  if (canAccessAllCamps(role)) return true;
  // External owners are scoped by ownership, not camp assignment
  if (role === Role.EXTERNAL_OWNER) return false;
  return assignedCampIds.includes(campId);
}
