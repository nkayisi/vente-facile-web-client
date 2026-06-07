"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import type { AsyncSelectOption } from "@/components/ui/searchable-select-async";

/**
 * Hook qui charge UN objet par ID pour pré-remplir un ``SearchableSelectAsync``
 * lors de l'édition d'une entité dont la valeur référencée est hors de la
 * première page de résultats de la recherche async.
 *
 * Sans ce hook, le composant async afficherait "Aucune" tant que la liste
 * n'a pas été ouverte, parce que l'objet correspondant à ``value`` n'est
 * pas dans son cache. Avec le hook, on déclenche un fetch ciblé ``GET
 * /{entity}/{id}/`` au mount, et on passe le résultat en ``initialOption``.
 *
 * Pattern d'usage :
 *
 *   const { initialOption } = useInitialOption({
 *     value: product.category,
 *     organizationId: organization.id,
 *     fetchById: (token, orgId, id) => getCategory(token, orgId, id),
 *     formatLabel: (cat) => cat.name,
 *   });
 *
 * Effets : un seul appel API tant que ``value`` est inchangée. Le hook
 * réfait un fetch si la valeur change (ex. utilisateur change le produit
 * sans recharger la page).
 */
export interface UseInitialOptionParams<T> {
  /** ID à charger ; null/undefined → le hook ne fait rien */
  value: string | null | undefined;
  /** ID d'organisation pour scoper l'appel API */
  organizationId: string | null | undefined;
  /** Fonction de fetch (ex. ``getCategory``, ``getBrand``...) */
  fetchById: (
    token: string,
    orgId: string,
    id: string,
  ) => Promise<{ success: boolean; data?: T; message?: string }>;
  /** Transformation T → label affichable */
  formatLabel: (item: T) => string;
}

export interface UseInitialOptionResult {
  initialOption?: AsyncSelectOption;
  loading: boolean;
  error?: string;
}

export function useInitialOption<T>({
  value,
  organizationId,
  fetchById,
  formatLabel,
}: UseInitialOptionParams<T>): UseInitialOptionResult {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  const [initialOption, setInitialOption] = useState<AsyncSelectOption | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    if (!value || !accessToken || !organizationId) {
      setInitialOption(undefined);
      return;
    }

    setLoading(true);
    fetchById(accessToken, organizationId, value)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setInitialOption({ value, label: formatLabel(result.data) });
          setError(undefined);
        } else {
          setError(result.message || "Impossible de charger la valeur sélectionnée");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as Error)?.message || "Erreur réseau");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // ``fetchById`` et ``formatLabel`` sont stables (références fonctions
    // déclarées au top-level), donc on ne les met pas dans les deps pour
    // éviter de re-déclencher à chaque render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, accessToken, organizationId]);

  return { initialOption, loading, error };
}
