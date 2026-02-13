// Types et constantes pour le système RBAC

export type Role = 'owner' | 'manager' | 'stock_keeper' | 'cashier';

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Administrateur',
  manager: 'Gérant',
  stock_keeper: 'Magasinier',
  cashier: 'Caissier',
};

export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  manager: 3,
  stock_keeper: 2,
  cashier: 1,
};

export interface ManageableRole {
  value: string;
  label: string;
}

export interface UserPermissions {
  role: Role;
  role_display: string;
  permissions: string[];
  manageable_roles: ManageableRole[];
}

export function hasPermission(
  userPermissions: UserPermissions | null,
  permission: string
): boolean {
  if (!userPermissions) return false;
  return userPermissions.permissions.includes(permission);
}

export function hasAnyPermission(
  userPermissions: UserPermissions | null,
  permissions: string[]
): boolean {
  if (!userPermissions) return false;
  return permissions.some((p) => userPermissions.permissions.includes(p));
}

export function hasAllPermissions(
  userPermissions: UserPermissions | null,
  permissions: string[]
): boolean {
  if (!userPermissions) return false;
  return permissions.every((p) => userPermissions.permissions.includes(p));
}

export function isRole(
  userPermissions: UserPermissions | null,
  role: Role
): boolean {
  if (!userPermissions) return false;
  return userPermissions.role === role;
}

export function isAtLeastRole(
  userPermissions: UserPermissions | null,
  role: Role
): boolean {
  if (!userPermissions) return false;
  return (ROLE_HIERARCHY[userPermissions.role] || 0) >= (ROLE_HIERARCHY[role] || 0);
}

export function canManageRole(
  userPermissions: UserPermissions | null,
  targetRole: string
): boolean {
  if (!userPermissions) return false;
  return userPermissions.manageable_roles.some((r) => r.value === targetRole);
}
