"use client";

/**
 * Les entrepôts d'un écran : ce qu'on peut LIRE, ce où l'on peut AGIR, et
 * l'annuaire des destinations.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UNE SEULE PORTE VERS LES ENTREPÔTS, ET ELLE SUIT LE PÉRIMÈTRE.          │
 * │                                                                          │
 * │ Chaque page lisait sa liste à sa façon : la première page seulement, ou  │
 * │ `is_active` forcé, ou rien du tout pour un caissier. Et aucune ne se     │
 * │ relisait après une affectation : un gérant à qui le propriétaire venait  │
 * │ d'affecter un entrepôt ne le voyait qu'en rechargeant la page.           │
 * │                                                                          │
 * │ Les deux listes sont rangées sous l'empreinte du périmètre               │
 * │ (`perimetre_version`) : dès que les droits relus en portent une autre    │
 * │ (affectation, case « Consulter tous », entrepôt désactivé), elles se     │
 * │ relisent d'elles-mêmes.                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { membreDepuisPermissions, verrouEntrepot } from "@vente-facile/core";

import { getWarehouseDirectory, getWarehouses, type Warehouse } from "@/actions/stock.actions";
import { useOrganization } from "@/components/auth/organization-checker";
import { usePermissions } from "@/components/auth/permissions-provider";
import { createWarehouseSearchHandler, type SearchHandler } from "@/lib/select-search-handlers";
import { entrepotsPourUsage, type EntreeAnnuaire } from "@/lib/stock/entrepots";

export const CLE_ENTREPOTS = "entrepots";
export const CLE_ANNUAIRE = "annuaire-entrepots";

export function useEntrepots(options: { liste?: boolean; annuaire?: boolean } = {}) {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { permissions } = usePermissions();
  const queryClient = useQueryClient();

  const jeton = session?.accessToken ?? "";
  const orgId = organization?.id ?? "";
  const pret = Boolean(jeton && orgId);
  const version = permissions?.perimetre_version ?? "";

  const membre = useMemo(
    () => (permissions ? membreDepuisPermissions(permissions) : null),
    [permissions],
  );

  const liste = useQuery({
    queryKey: [CLE_ENTREPOTS, orgId, version],
    queryFn: async () => {
      const r = await getWarehouses(jeton, orgId);
      if (!r.success || !r.data) throw new Error(r.message || "Erreur lors du chargement des entrepôts");
      return r.data;
    },
    enabled: pret && Boolean(options.liste),
    staleTime: 60 * 1000,
  });

  const annuaire = useQuery({
    queryKey: [CLE_ANNUAIRE, orgId, version],
    queryFn: async () => {
      const r = await getWarehouseDirectory(jeton, orgId);
      if (!r.success || !r.data) throw new Error(r.message || "Erreur lors du chargement des entrepôts");
      return r.data;
    },
    enabled: pret && Boolean(options.annuaire),
    staleTime: 60 * 1000,
  });

  // Les deux sélecteurs, stables tant que le jeton, l'établissement et les
  // droits ne changent pas : un `onSearch` neuf à chaque rendu ne recharge
  // rien (`hasLoadedInitial`), mais il ne doit pas non plus porter de vieux droits.
  const chercher = useMemo<Record<"action" | "lecture", SearchHandler>>(() => {
    const vide: SearchHandler = async () => [];
    if (!pret) return { action: vide, lecture: vide };
    return {
      action: createWarehouseSearchHandler(jeton, orgId, "action", { membre }),
      lecture: createWarehouseSearchHandler(jeton, orgId, "lecture", { membre }),
    };
  }, [pret, jeton, orgId, membre]);

  const tous: Warehouse[] = useMemo(() => liste.data ?? [], [liste.data]);
  const actionnables = useMemo(() => entrepotsPourUsage(membre, tous, "action"), [membre, tous]);

  /** Le verrou d'une SAISIE : aucun entrepôt actif, ou un seul. */
  const verrouAction = useMemo(
    () => (membre && liste.isSuccess ? verrouEntrepot(membre, actionnables.length, "action") : null),
    [membre, liste.isSuccess, actionnables.length],
  );

  const invalider = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [CLE_ENTREPOTS, orgId] }),
      queryClient.invalidateQueries({ queryKey: [CLE_ANNUAIRE, orgId] }),
    ]);
  }, [queryClient, orgId]);

  return {
    membre,
    chercher,
    /** Ce que le serveur rend en lecture, inactifs compris. */
    tous,
    /** Ses entrepôts affectés et actifs (tous les actifs pour le propriétaire). */
    actionnables,
    verrouAction,
    chargementListe: liste.isPending && liste.fetchStatus !== "idle",
    erreurListe: liste.error ? (liste.error as Error).message : null,
    annuaire: (annuaire.data?.entrepots ?? []) as EntreeAnnuaire[],
    /** Vrai quand le serveur n'a pas d'annuaire : on n'a que nos propres entrepôts. */
    annuaireDegrade: Boolean(annuaire.data?.degrade),
    chargementAnnuaire: annuaire.isPending && annuaire.fetchStatus !== "idle",
    invalider,
  };
}
