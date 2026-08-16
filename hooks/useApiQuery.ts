"use client";

import { useQuery, type UseQueryOptions, type QueryKey } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/components/auth/permissions-provider";

/**
 * Wrapper conventionnel autour de ``useQuery`` qui :
 * - n'exécute la query que quand ``session.accessToken`` ET ``organizationId``
 *   sont disponibles (évite les calls avant hydration / login) ;
 * - injecte automatiquement ``accessToken`` + ``organizationId`` dans la
 *   fonction de fetch - les server actions du projet attendent ces deux
 *   arguments en premier ;
 * - dépape la réponse ``ApiResponse<T>`` : retourne directement ``data`` ou
 *   throw avec le message d'erreur (pour que ``useQuery`` passe en ``error``).
 *
 * Pattern d'usage :
 *
 *   const { data, isLoading, error } = useApiQuery({
 *     queryKey: ["units", { page: 1 }],
 *     fetchFn: (token, orgId) => getUnits(token, orgId, { page: 1 }),
 *   });
 *
 * Migration depuis ``useEffect + fetch`` :
 *   - on supprime le state local (``units``, ``isLoading``, ``totalCount``)
 *     et on lit directement depuis ``data`` / ``isLoading`` retournés ici ;
 *   - le cache (1 min par défaut) et la dédup sont automatiques ;
 *   - pour invalider après une mutation côté server action, ajouter
 *     ``revalidatePath(...)`` dans l'action ET ``queryClient.invalidateQueries``
 *     côté client si on veut un refresh sans navigation.
 */
export interface UseApiQueryOptions<TData> {
  queryKey: QueryKey;
  fetchFn: (accessToken: string, organizationId: string) => Promise<{
    success: boolean;
    data?: TData;
    message?: string;
    error?: string;
  }>;
  /** Désactive la query (ex. en attente d'un autre fetch) */
  enabled?: boolean;
  /** Override ``staleTime`` (défaut : 60 000 ms = 1 min, configuré globalement) */
  staleTime?: number;
  /** Hook lifecycle de react-query (onSuccess, etc.). */
  options?: Omit<UseQueryOptions<TData, Error, TData>, "queryKey" | "queryFn">;
}

export function useApiQuery<TData>({
  queryKey,
  fetchFn,
  enabled = true,
  staleTime,
  options,
}: UseApiQueryOptions<TData>) {
  const { data: session } = useSession();
  const { organizationId } = usePermissions();

  const accessToken = session?.accessToken;
  const isReady = Boolean(accessToken && organizationId);

  return useQuery<TData, Error>({
    queryKey,
    queryFn: async () => {
      if (!accessToken || !organizationId) {
        throw new Error("Session ou organisation non disponible");
      }
      const result = await fetchFn(accessToken, organizationId);
      if (!result.success || result.data === undefined) {
        throw new Error(result.message || result.error || "Erreur API");
      }
      return result.data;
    },
    enabled: enabled && isReady,
    staleTime,
    ...options,
  });
}
