"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useOrganization } from "@/components/auth/organization-checker";
import { getUserPermissions } from "@/actions/permissions.actions";
import type { UserPermissions, Role } from "@/lib/permissions";
import { doitRelireLesDroits, type ReponseRefusable } from "@/lib/perimeter-refusal";
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
  /**
   * Relit les droits si cette réponse est un refus de périmètre
   * (`consultation_seule`, `entrepot_inactif`, `stock_insuffisant`). Rend
   * `true` quand elle a relu : l'écran peut alors recharger ce qu'il montre.
   */
  relireSiRefus: (reponse: Pick<ReponseRefusable, "success" | "code" | "errors">) => boolean;
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
  relireSiRefus: () => false,
});

/** La clé des droits : PAR ORGANISATION, jamais par jeton (il tourne toutes les trente minutes). */
export const CLE_PERMISSIONS = "me-permissions";

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  // L'organisation est déjà chargée par OrganizationChecker (parent) : on la
  // consomme via le contexte plutôt que de refaire un appel getUserOrganizations.
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const accessToken = session?.accessToken;
  const orgId = organization?.id ?? null;

  // ┌────────────────────────────────────────────────────────────────────────┐
  // │ LES DROITS ÉTAIENT LUS UNE FOIS PAR SESSION, ET JAMAIS RELUS.          │
  // │                                                                        │
  // │ Un drapeau `hasFetched` bloquait toute relecture : un gérant à qui le  │
  // │ propriétaire venait d'affecter un entrepôt restait verrouillé sur      │
  // │ « Aucun entrepôt ne vous est assigné » jusqu'au rechargement complet,  │
  // │ et un établissement rouvert depuis l'écran de suspension gardait les   │
  // │ droits du précédent. On relit au retour sur l'onglet (au plus une fois │
  // │ par minute) et à chaque changement d'établissement.                    │
  // └────────────────────────────────────────────────────────────────────────┘
  const requete = useQuery({
    queryKey: [CLE_PERMISSIONS, orgId],
    queryFn: async () => {
      const resultat = await getUserPermissions(accessToken!, orgId!);
      if (!resultat.success || !resultat.data) {
        throw new Error(resultat.error || "Erreur lors du chargement des permissions");
      }
      return resultat.data;
    },
    enabled: status === "authenticated" && Boolean(accessToken) && Boolean(orgId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const permissions = requete.data ?? null;
  // ⚠ « En attente » n'est pas « en chargement » : une requête désactivée
  // (pas encore de session) attend sans rien charger, et l'écran ne doit pas
  // tourner indéfiniment sur un sablier.
  const isLoading = status === "loading" || (requete.isPending && requete.fetchStatus !== "idle");
  const error = requete.error ? (requete.error as Error).message : null;

  const fetchPermissions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [CLE_PERMISSIONS, orgId] });
  }, [queryClient, orgId]);

  // ┌────────────────────────────────────────────────────────────────────────┐
  // │ UN REFUS DE PÉRIMÈTRE DIT QUE NOS DROITS ONT VIEILLI.                  │
  // │                                                                        │
  // │ L'écran proposait un geste que le serveur refuse : une affectation a   │
  // │ été retirée, un entrepôt désactivé. On relit tout de suite, sans       │
  // │ attendre le retour sur l'onglet. Les listes d'entrepôts dépendent de   │
  // │ `perimetre_version` (voir `useEntrepots`) : si l'empreinte a bougé,    │
  // │ elles se relisent d'elles-mêmes.                                       │
  // └────────────────────────────────────────────────────────────────────────┘
  const relireSiRefus = useCallback(
    (reponse: Pick<ReponseRefusable, "success" | "code" | "errors">) => {
      if (!doitRelireLesDroits(reponse)) return false;
      void queryClient.invalidateQueries({ queryKey: [CLE_PERMISSIONS, orgId] });
      return true;
    },
    [queryClient, orgId],
  );

  const organizationId = orgId;

  const value = useMemo<PermissionsContextType>(() => ({
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
    relireSiRefus,
  }), [permissions, isLoading, error, organizationId, fetchPermissions, relireSiRefus]);

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
