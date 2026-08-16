"use client";

import { useApiQuery } from "@/hooks/useApiQuery";
import { getUnits, type Unit, type UnitFilters } from "@/actions/products.actions";
import type { PaginatedResponse } from "@/actions/products.actions";

/**
 * Exemple de hook ``useQuery`` pour la liste des unités.
 *
 * Pattern à dupliquer pour les autres entités (products, categories, brands,
 * customers, sales, etc.). Conventions :
 * - ``queryKey`` commence par un identifiant stable de l'entité, suivi des
 *   filtres sérialisés - ainsi deux pages avec des filtres différents ont
 *   leur propre cache.
 * - Les mutations correspondantes invalident cette key via
 *   ``queryClient.invalidateQueries({ queryKey: ["units"] })`` (préfixe).
 */
export const unitsKeys = {
  all: ["units"] as const,
  list: (filters?: UnitFilters) => [...unitsKeys.all, "list", filters] as const,
  detail: (id: string) => [...unitsKeys.all, "detail", id] as const,
};

export function useUnits(filters?: UnitFilters) {
  return useApiQuery<PaginatedResponse<Unit>>({
    queryKey: unitsKeys.list(filters),
    fetchFn: (token, orgId) => getUnits(token, orgId, filters),
  });
}
