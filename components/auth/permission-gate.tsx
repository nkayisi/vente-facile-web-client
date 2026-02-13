"use client";

import type { ReactNode } from "react";
import { usePermissions } from "./permissions-provider";
import type { Role } from "@/lib/permissions";

interface PermissionGateProps {
  children: ReactNode;
  /** Permission requise (ex: 'products.view') */
  permission?: string;
  /** Au moins une de ces permissions requise */
  anyPermission?: string[];
  /** Toutes ces permissions requises */
  allPermissions?: string[];
  /** Rôle exact requis */
  role?: Role;
  /** Rôle minimum requis dans la hiérarchie */
  minRole?: Role;
  /** Contenu affiché si l'utilisateur n'a pas la permission */
  fallback?: ReactNode;
  /** Si true, masque complètement au lieu d'afficher le fallback */
  hide?: boolean;
}

export function PermissionGate({
  children,
  permission,
  anyPermission,
  allPermissions,
  role,
  minRole,
  fallback = null,
  hide = true,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isRole, isAtLeastRole, isLoading } =
    usePermissions();

  if (isLoading) {
    return hide ? null : <>{fallback}</>;
  }

  let allowed = true;

  if (permission) {
    allowed = allowed && hasPermission(permission);
  }

  if (anyPermission) {
    allowed = allowed && hasAnyPermission(anyPermission);
  }

  if (allPermissions) {
    allowed = allowed && hasAllPermissions(allPermissions);
  }

  if (role) {
    allowed = allowed && isRole(role);
  }

  if (minRole) {
    allowed = allowed && isAtLeastRole(minRole);
  }

  if (!allowed) {
    return hide ? null : <>{fallback}</>;
  }

  return <>{children}</>;
}
