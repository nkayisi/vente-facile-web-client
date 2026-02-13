"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { getUserOrganizations } from "@/actions/organization.actions";
import { getUserPermissions } from "@/actions/permissions.actions";
import type {
  UserPermissions,
  Role,
} from "@/lib/permissions";
import {
  hasPermission as _hasPermission,
  hasAnyPermission as _hasAnyPermission,
  hasAllPermissions as _hasAllPermissions,
  isRole as _isRole,
  isAtLeastRole as _isAtLeastRole,
  canManageRole as _canManageRole,
} from "@/lib/permissions";

interface PermissionsContextType {
  permissions: UserPermissions | null;
  isLoading: boolean;
  error: string | null;
  organizationId: string | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isRole: (role: Role) => boolean;
  isAtLeastRole: (role: Role) => boolean;
  canManageRole: (targetRole: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: null,
  isLoading: true,
  error: null,
  organizationId: null,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  isRole: () => false,
  isAtLeastRole: () => false,
  canManageRole: () => false,
  refreshPermissions: async () => { },
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (status !== "authenticated" || !session?.accessToken) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      // Récupérer l'organisation active
      const orgsResult = await getUserOrganizations(session.accessToken);
      if (!orgsResult.success || !orgsResult.data || orgsResult.data.length === 0) {
        setIsLoading(false);
        return;
      }

      const orgId = orgsResult.data[0].id;
      setOrganizationId(orgId);

      // Récupérer les permissions
      const permResult = await getUserPermissions(session.accessToken, orgId);
      if (permResult.success && permResult.data) {
        setPermissions(permResult.data);
      } else {
        setError(permResult.error || "Erreur lors du chargement des permissions");
      }
    } catch (err: any) {
      setError(err.message || "Erreur inattendue");
    } finally {
      setIsLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const value: PermissionsContextType = {
    permissions,
    isLoading,
    error,
    organizationId,
    hasPermission: (permission: string) => _hasPermission(permissions, permission),
    hasAnyPermission: (perms: string[]) => _hasAnyPermission(permissions, perms),
    hasAllPermissions: (perms: string[]) => _hasAllPermissions(permissions, perms),
    isRole: (role: Role) => _isRole(permissions, role),
    isAtLeastRole: (role: Role) => _isAtLeastRole(permissions, role),
    canManageRole: (targetRole: string) => _canManageRole(permissions, targetRole),
    refreshPermissions: fetchPermissions,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
