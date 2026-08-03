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
  manageUsers: [Role.OWNER, Role.FARM_MANAGER],
  manageCamps: [Role.OWNER, Role.FARM_MANAGER],
  /** Dated journal notes on a camp — owner, manager, or assigned supervisor. */
  addCampNotes: [Role.OWNER, Role.FARM_MANAGER, Role.CAMP_SUPERVISOR],
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
    Role.RECORDS_CLERK,
  ],
  /** Core identity: eartag, pedigree, owner, camp, notes, status — ranch OWNER only. */
  editAnimal: [Role.OWNER],
  /** Operational logs (weights, photos) for day-to-day staff. */
  updateAnimalRecords: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.RECORDS_CLERK,
    Role.CAMP_SUPERVISOR,
  ],
  deleteAnimal: [Role.OWNER],
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
  ],
  manageBreeding: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.CAMP_SUPERVISOR,
    Role.RECORDS_CLERK,
  ],
  /** Publish death / culling — owner or farm manager (eartag photo recommended). */
  manageMortality: [Role.OWNER, Role.FARM_MANAGER],
  /** Change a death record after it is published — ranch OWNER only. */
  editMortality: [Role.OWNER],
  manageSales: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.RECORDS_CLERK,
  ],
  /** See sales amounts / sales reports (not buyer contact book). */
  viewSales: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.RECORDS_CLERK,
    Role.VIEWER,
  ],
  manageBuyers: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.RECORDS_CLERK,
  ],
  viewBuyers: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.RECORDS_CLERK,
  ],
  manageFinance: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.RECORDS_CLERK,
  ],
  viewFinance: [
    Role.OWNER,
    Role.FARM_MANAGER,
    Role.RECORDS_CLERK,
    Role.VIEWER,
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
